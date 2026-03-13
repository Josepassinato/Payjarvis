/**
 * Assisted Fallback — Layer 4
 *
 * When the local CDP-based browser agent hits an obstacle (CAPTCHA, auth, etc.),
 * this module spins up a Browserbase cloud session, attempts the action,
 * and returns NEEDS_HANDOFF if blocked so a human can take over via live view.
 */

import { chromium } from "playwright-core";
import type { Browser, Page } from "playwright-core";
import {
  createSession,
  getSessionLiveURLs,
  closeSession,
  isConfigured,
} from "./browserbase-client.js";

// ─── Types ───────────────────────────────────────────

export interface FallbackAction {
  url: string;
  task: string;
  params?: Record<string, unknown>;
}

export interface AssistedFallbackResult {
  status: "COMPLETED" | "NEEDS_HANDOFF" | "FAILED";
  sessionId: string;
  liveViewURL?: string;
  connectUrl?: string;
  result?: unknown;
  error?: string;
}

// ─── Obstacle Detection ─────────────────────────────

interface ObstacleCheck {
  blocked: boolean;
  type?: "CAPTCHA" | "AUTH" | "NAVIGATION" | "OTHER";
  description?: string;
}

async function detectObstacle(page: Page): Promise<ObstacleCheck> {
  try {
    return await page.evaluate(() => {
      const body = document.body?.innerText?.toLowerCase() || "";
      const url = window.location.href;

      // CAPTCHA detection
      if (
        document.querySelector('form[action*="captcha"]') ||
        document.querySelector("#captchacharacters") ||
        body.includes("enter the characters you see below") ||
        body.includes("type the characters") ||
        url.includes("/errors/validateCaptcha") ||
        document.querySelector('[class*="captcha"]') ||
        document.querySelector("iframe[src*='recaptcha']") ||
        document.querySelector("iframe[src*='hcaptcha']")
      ) {
        return {
          blocked: true,
          type: "CAPTCHA" as const,
          description: "CAPTCHA or security challenge detected",
        };
      }

      // Auth detection
      if (
        document.querySelector("#auth-mfa-otpcode") ||
        document.querySelector("#ap_password") ||
        url.includes("/ap/signin") ||
        url.includes("/ap/mfa") ||
        url.includes("/login") ||
        (document.querySelector('input[type="password"]') &&
          document.querySelector('form[action*="auth"]'))
      ) {
        return {
          blocked: true,
          type: "AUTH" as const,
          description: "Login or multi-factor authentication required",
        };
      }

      // Navigation/error detection
      if (
        (body.includes("sorry! something went wrong") &&
          url.includes("amazon")) ||
        body.includes("we could not process your order") ||
        body.includes("access denied") ||
        body.includes("403 forbidden") ||
        document.querySelector("#error-page")
      ) {
        return {
          blocked: true,
          type: "NAVIGATION" as const,
          description: "Error page or access blocked",
        };
      }

      return { blocked: false };
    });
  } catch {
    return { blocked: false };
  }
}

// ─── Main Fallback Flow ─────────────────────────────

/**
 * Execute an assisted fallback: spin up a cloud browser, attempt the task,
 * return NEEDS_HANDOFF if blocked so a human can take over.
 */
export async function assistedFallback(
  botId: string,
  action: FallbackAction
): Promise<AssistedFallbackResult> {
  if (!isConfigured()) {
    return {
      status: "FAILED",
      sessionId: "",
      error: "Browserbase is not configured (missing BROWSERBASE_API_KEY or BROWSERBASE_PROJECT_ID)",
    };
  }

  let sessionId = "";
  let connectUrl = "";
  let browser: Browser | null = null;

  try {
    // 1. Create Browserbase session
    const sessionResult = await createSession({
      keepAlive: true,
      timeout: 300,
      browserSettings: {
        blockAds: true,
      },
    });

    sessionId = sessionResult.sessionId;
    connectUrl = sessionResult.connectUrl;

    console.log(
      `[AssistedFallback] Session created: ${sessionId} for bot ${botId}`
    );

    // 2. Connect Playwright to the Browserbase session
    browser = await chromium.connectOverCDP(connectUrl);
    const defaultContext = browser.contexts()[0];
    const page = defaultContext?.pages()[0] ?? (await defaultContext.newPage());

    // 3. Navigate to URL
    console.log(`[AssistedFallback] Navigating to: ${action.url}`);
    await page.goto(action.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Give the page a moment to settle
    await page.waitForTimeout(2000);

    // 4. Check for obstacles
    const obstacle = await detectObstacle(page);

    if (obstacle.blocked) {
      // 5. Blocked — get live view URL for handoff
      console.log(
        `[AssistedFallback] Obstacle detected: ${obstacle.type} — ${obstacle.description}`
      );

      let liveViewURL: string | undefined;
      try {
        const liveURLs = await getSessionLiveURLs(sessionId);
        liveViewURL = liveURLs.debuggerFullscreenUrl;
      } catch (err) {
        console.error("[AssistedFallback] Failed to get live URLs:", err);
      }

      // Disconnect Playwright but keep session alive for human
      await browser.close();

      return {
        status: "NEEDS_HANDOFF",
        sessionId,
        liveViewURL,
        connectUrl,
        result: {
          obstacleType: obstacle.type,
          description: obstacle.description,
          currentUrl: page.url(),
        },
      };
    }

    // 6. No obstacle — try to execute the task
    console.log(`[AssistedFallback] No obstacle, executing task: ${action.task}`);

    let taskResult: unknown = null;

    switch (action.task) {
      case "extract_content": {
        const title = await page.title();
        const content = await page.evaluate(
          () => (document.body?.innerText || "").substring(0, 5000)
        );
        taskResult = { title, content, url: page.url() };
        break;
      }

      case "screenshot": {
        const screenshot = await page.screenshot({ type: "png" });
        taskResult = {
          screenshot: screenshot.toString("base64"),
          url: page.url(),
        };
        break;
      }

      case "fill_form": {
        const params = action.params as Record<string, string> | undefined;
        if (params) {
          for (const [selector, value] of Object.entries(params)) {
            try {
              await page.fill(selector, value);
            } catch {
              console.warn(
                `[AssistedFallback] Could not fill ${selector}`
              );
            }
          }
        }
        taskResult = { filled: true, url: page.url() };
        break;
      }

      case "click": {
        const selector = (action.params as { selector?: string })?.selector;
        if (selector) {
          await page.click(selector);
          await page.waitForTimeout(2000);
        }
        taskResult = { clicked: true, url: page.url() };
        break;
      }

      default: {
        // Generic: just extract page info
        const title = await page.title();
        taskResult = {
          title,
          url: page.url(),
          task: action.task,
          note: "Task completed — page loaded successfully",
        };
        break;
      }
    }

    // 7. Close session on completion
    await browser.close();
    try {
      await closeSession(sessionId);
    } catch {
      // Session may already be closing
    }

    return {
      status: "COMPLETED",
      sessionId,
      result: taskResult,
    };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error during fallback";
    console.error(`[AssistedFallback] Error:`, err);

    // Clean up
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore
      }
    }

    if (sessionId) {
      try {
        await closeSession(sessionId);
      } catch {
        // ignore
      }
    }

    return {
      status: "FAILED",
      sessionId,
      error: errorMessage,
    };
  }
}
