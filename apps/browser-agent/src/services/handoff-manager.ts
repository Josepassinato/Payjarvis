/**
 * Handoff Manager — Layer 4
 *
 * Manages the human handoff flow when the browser agent encounters
 * an obstacle it cannot resolve autonomously.
 *
 * Flow:
 * 1. Get live view URL from Browserbase
 * 2. Create HandoffRequest in PayJarvis API
 * 3. Send notification to user with live URL
 * 4. Return handoff details
 */

import {
  getSessionLiveURLs,
  closeSession,
  getSession,
} from "./browserbase-client.js";

// ─── Types ───────────────────────────────────────────

export type ObstacleType = "CAPTCHA" | "AUTH" | "NAVIGATION" | "OTHER";

export interface HandoffResult {
  success: boolean;
  handoffId?: string;
  sessionId: string;
  liveViewURL?: string;
  connectUrl?: string;
  obstacleType: ObstacleType;
  message: string;
  expiresAt?: string;
  error?: string;
}

export interface ResolveResult {
  success: boolean;
  sessionId: string;
  message: string;
  error?: string;
}

// ─── Friendly Messages ──────────────────────────────

const OBSTACLE_MESSAGES: Record<ObstacleType, string> = {
  CAPTCHA: "Found a security check that needs your attention.",
  AUTH: "This step needs you to log in directly.",
  NAVIGATION: "Need your help navigating this page.",
  OTHER: "Almost there! Just need you to complete this part.",
};

function getObstacleMessage(type: ObstacleType): string {
  return OBSTACLE_MESSAGES[type] ?? OBSTACLE_MESSAGES.OTHER;
}

// ─── Request Handoff ─────────────────────────────────

/**
 * Request a human handoff for a Browserbase session.
 *
 * 1. Gets the live view URL from Browserbase
 * 2. Creates a HandoffRequest via the PayJarvis API
 * 3. The API will send notification to the user
 * 4. Returns handoff details
 */
export async function requestHandoff(
  sessionId: string,
  botId: string,
  reason: {
    type: ObstacleType;
    description?: string;
    currentUrl?: string;
  }
): Promise<HandoffResult> {
  const friendlyMessage = getObstacleMessage(reason.type);

  try {
    // 1. Get live view URL from Browserbase
    let liveViewURL: string | undefined;
    let connectUrl: string | undefined;

    try {
      const liveURLs = await getSessionLiveURLs(sessionId);
      liveViewURL = liveURLs.debuggerFullscreenUrl;

      // Also get the session to retrieve connectUrl
      const session = await getSession(sessionId);
      connectUrl = session.connectUrl;
    } catch (err) {
      console.error("[HandoffManager] Failed to get live URLs:", err);
      // Continue — we can still create the handoff without the live URL
    }

    // 2. Create HandoffRequest via PayJarvis API
    const apiUrl = process.env.PAYJARVIS_API_URL ?? "http://localhost:3001";
    const botApiKey = process.env.BROWSER_AGENT_BOT_API_KEY;

    if (!botApiKey) {
      return {
        success: false,
        sessionId,
        obstacleType: reason.type,
        message: friendlyMessage,
        error: "BROWSER_AGENT_BOT_API_KEY not configured — cannot create handoff request",
      };
    }

    const handoffPayload = {
      sessionUrl: liveViewURL ?? reason.currentUrl ?? `browserbase://session/${sessionId}`,
      obstacleType: reason.type,
      description: `${friendlyMessage} ${reason.description ?? ""}`.trim(),
      metadata: {
        browserbaseSessionId: sessionId,
        connectUrl,
        liveViewURL,
        currentUrl: reason.currentUrl,
      },
    };

    const handoffRes = await fetch(
      `${apiUrl}/bots/${botId}/request-handoff`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Bot-Api-Key": botApiKey,
        },
        body: JSON.stringify(handoffPayload),
      }
    );

    const handoffData = (await handoffRes.json()) as {
      success: boolean;
      data?: { handoffId: string; status: string; expiresAt: string };
      error?: string;
    };

    if (!handoffData.success) {
      return {
        success: false,
        sessionId,
        obstacleType: reason.type,
        message: friendlyMessage,
        error: `PayJarvis API rejected handoff: ${handoffData.error ?? "unknown error"}`,
      };
    }

    console.log(
      `[HandoffManager] Handoff created: ${handoffData.data!.handoffId} for session ${sessionId}`
    );

    // 3. Notification is sent by the API (notifyHandoffCreated)
    // No need to send it again here.

    return {
      success: true,
      handoffId: handoffData.data!.handoffId,
      sessionId,
      liveViewURL,
      connectUrl,
      obstacleType: reason.type,
      message: friendlyMessage,
      expiresAt: handoffData.data!.expiresAt,
    };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error requesting handoff";
    console.error("[HandoffManager] Error:", err);

    return {
      success: false,
      sessionId,
      obstacleType: reason.type,
      message: friendlyMessage,
      error: errorMessage,
    };
  }
}

// ─── Resolve Handoff ─────────────────────────────────

/**
 * Resolve a handoff: close the Browserbase session and mark as resolved.
 */
export async function resolveHandoff(
  sessionId: string,
  note?: string
): Promise<ResolveResult> {
  try {
    // Close the Browserbase session
    try {
      await closeSession(sessionId);
      console.log(`[HandoffManager] Session ${sessionId} closed`);
    } catch (err) {
      // Session may already be closed/expired
      console.warn(
        `[HandoffManager] Could not close session ${sessionId}:`,
        err instanceof Error ? err.message : err
      );
    }

    return {
      success: true,
      sessionId,
      message: note ?? "Handoff resolved and session closed.",
    };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error resolving handoff";
    console.error("[HandoffManager] Resolve error:", err);

    return {
      success: false,
      sessionId,
      message: "Failed to resolve handoff.",
      error: errorMessage,
    };
  }
}
