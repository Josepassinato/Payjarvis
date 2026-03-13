/**
 * Human Behavior Simulation for CDP Browser Agent
 *
 * Camada 1: Fingerprint humano (User-Agent, plugins, viewport, WebGL, etc.)
 * Camada 2: Comportamento humano (mouse Bezier, digitacao, scroll, pausas)
 * Camada 3: Sessao persistente (cookies, navegacao realista, referer)
 * Camada 4: Fallback inteligente (deteccao de bloqueio)
 */

// ─── Camada 1: Fingerprint Humano ────────────────────

const USER_AGENTS = [
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    platform: "Win32",
    brands: [
      { brand: "Google Chrome", version: "122" },
      { brand: "Chromium", version: "122" },
      { brand: "Not(A:Brand", version: "24" },
    ],
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    platform: "MacIntel",
    brands: [
      { brand: "Google Chrome", version: "122" },
      { brand: "Chromium", version: "122" },
      { brand: "Not(A:Brand", version: "24" },
    ],
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    platform: "Win32",
    brands: [
      { brand: "Google Chrome", version: "125" },
      { brand: "Chromium", version: "125" },
      { brand: "Not.A/Brand", version: "24" },
    ],
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    platform: "MacIntel",
    brands: [
      { brand: "Google Chrome", version: "125" },
      { brand: "Chromium", version: "125" },
      { brand: "Not.A/Brand", version: "24" },
    ],
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    platform: "Win32",
    brands: [
      { brand: "Google Chrome", version: "124" },
      { brand: "Chromium", version: "124" },
      { brand: "Not_A Brand", version: "8" },
    ],
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    platform: "Win32",
    brands: [
      { brand: "Google Chrome", version: "123" },
      { brand: "Chromium", version: "123" },
      { brand: "Not:A-Brand", version: "8" },
    ],
  },
];

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1680, height: 1050 },
];

export type SendCmdFn = (
  method: string,
  params?: Record<string, unknown>
) => Promise<Record<string, unknown>>;

// ─── Anti-Detection Injection Script ─────────────────

function buildStealthScript(profile: (typeof USER_AGENTS)[0], viewport: (typeof VIEWPORTS)[0]): string {
  const hwConcurrency = 4 + Math.floor(Math.random() * 9);
  const devMemory = [4, 8, 16][Math.floor(Math.random() * 3)];

  return `
    // Remove webdriver flag
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // Fake plugins array (realistic Chrome plugins)
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ];
        plugins.length = 3;
        return plugins;
      }
    });

    // Languages — pt-BR first (Brazilian user)
    Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
    Object.defineProperty(navigator, 'language', { get: () => 'pt-BR' });

    // Platform
    Object.defineProperty(navigator, 'platform', { get: () => '${profile.platform}' });

    // Hardware concurrency
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => ${hwConcurrency} });

    // Device memory
    Object.defineProperty(navigator, 'deviceMemory', { get: () => ${devMemory} });

    // Max touch points (desktop = 0)
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });

    // Chrome runtime object (full)
    window.chrome = {
      runtime: {
        PlatformOs: { MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux', OPENBSD: 'openbsd' },
        PlatformArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64', MIPS: 'mips', MIPS64: 'mips64' },
        PlatformNaclArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64', MIPS: 'mips', MIPS64: 'mips64' },
        RequestUpdateCheckStatus: { THROTTLED: 'throttled', NO_UPDATE: 'no_update', UPDATE_AVAILABLE: 'update_available' },
        OnInstalledReason: { INSTALL: 'install', UPDATE: 'update', CHROME_UPDATE: 'chrome_update', SHARED_MODULE_UPDATE: 'shared_module_update' },
        OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
      },
      loadTimes: function() { return {} },
      csi: function() { return {} },
      app: { isInstalled: false, InstallState: { INSTALLED: 'installed', NOT_INSTALLED: 'not_installed', DISABLED: 'disabled' }, RunningState: { RUNNING: 'running', CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run' } },
    };

    // Permissions API override
    const originalQuery = window.navigator.permissions?.query?.bind(window.navigator.permissions);
    if (originalQuery) {
      window.navigator.permissions.query = (params) =>
        params.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(params);
    }

    // WebGL vendor/renderer (realistic NVIDIA)
    const getParameterOrig = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(param) {
      if (param === 37445) return 'Google Inc. (NVIDIA)';
      if (param === 37446) return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)';
      return getParameterOrig.call(this, param);
    };
    const getParameterOrig2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function(param) {
      if (param === 37445) return 'Google Inc. (NVIDIA)';
      if (param === 37446) return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)';
      return getParameterOrig2.call(this, param);
    };

    // Screen dimensions matching viewport
    Object.defineProperty(screen, 'width', { get: () => ${viewport.width} });
    Object.defineProperty(screen, 'height', { get: () => ${viewport.height} });
    Object.defineProperty(screen, 'availWidth', { get: () => ${viewport.width} });
    Object.defineProperty(screen, 'availHeight', { get: () => ${viewport.height - 40} });
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });

    // Prevent iframe contentWindow detection
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      get: function() { return window; }
    });

    // Override connection info (non-headless)
    Object.defineProperty(navigator, 'connection', {
      get: () => ({
        effectiveType: '4g',
        rtt: 50,
        downlink: 10,
        saveData: false,
      })
    });

    // Hide automation-related properties
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
  `;
}

// ─── Camada 2: Comportamento Humano ──────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Bezier curve mouse movement with micro-jitter */
async function humanMouseMove(
  sendCmd: SendCmdFn,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Promise<void> {
  const steps = 25 + Math.floor(Math.random() * 15);
  const cpX = (startX + endX) / 2 + (Math.random() - 0.5) * 120;
  const cpY = (startY + endY) / 2 + (Math.random() - 0.5) * 80;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * cpX + t * t * endX;
    const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * cpY + t * t * endY;
    const jitterX = x + (Math.random() - 0.5) * 2;
    const jitterY = y + (Math.random() - 0.5) * 2;

    await sendCmd("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: Math.round(jitterX),
      y: Math.round(jitterY),
    });
    await sleep(10 + Math.random() * 20);
  }
}

/** Human-like typing — letter by letter with variable speed */
async function humanType(
  sendCmd: SendCmdFn,
  text: string
): Promise<void> {
  for (const char of text) {
    await sendCmd("Input.dispatchKeyEvent", {
      type: "keyDown",
      text: char,
      key: char,
      code: `Key${char.toUpperCase()}`,
    });
    await sendCmd("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: char,
      code: `Key${char.toUpperCase()}`,
    });
    // Variable typing speed — occasional pauses
    const delay = Math.random() < 0.1
      ? 200 + Math.random() * 300  // occasional pause (thinking)
      : 50 + Math.random() * 100;  // normal typing speed
    await sleep(delay);
  }
}

/** Click at position with human-like mouse movement first */
async function humanClick(
  sendCmd: SendCmdFn,
  x: number,
  y: number,
  fromX?: number,
  fromY?: number
): Promise<void> {
  // Move mouse to target first
  const startX = fromX ?? (x - 100 - Math.floor(Math.random() * 200));
  const startY = fromY ?? (y - 50 - Math.floor(Math.random() * 100));
  await humanMouseMove(sendCmd, startX, startY, x, y);

  await humanDelay.beforeClick();

  // Mouse down + up (realistic click)
  await sendCmd("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x, y,
    button: "left",
    clickCount: 1,
  });
  await sleep(50 + Math.random() * 100);
  await sendCmd("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x, y,
    button: "left",
    clickCount: 1,
  });

  await humanDelay.afterClick();
}

/** Smooth human scroll to a target Y position */
async function humanScrollTo(
  sendCmd: SendCmdFn,
  targetY: number,
  currentY: number
): Promise<void> {
  const distance = targetY - currentY;
  const steps = 10 + Math.floor(Math.random() * 10);

  for (let i = 0; i < steps; i++) {
    const stepDelta = distance / steps;
    const variation = stepDelta + (Math.random() - 0.5) * (stepDelta * 0.3);
    await sendCmd("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: 400 + Math.floor(Math.random() * 200),
      y: 400 + Math.floor(Math.random() * 200),
      deltaX: 0,
      deltaY: Math.round(variation),
    });
    await sleep(50 + Math.random() * 100);
  }
}

/** Smooth human scroll by delta amount */
async function humanScroll(
  sendCmd: SendCmdFn,
  deltaY: number
): Promise<void> {
  const steps = 8 + Math.floor(Math.random() * 8);
  const stepDelta = deltaY / steps;

  for (let i = 0; i < steps; i++) {
    const variation = stepDelta + (Math.random() - 0.5) * (stepDelta * 0.3);
    await sendCmd("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: 400 + Math.floor(Math.random() * 200),
      y: 400 + Math.floor(Math.random() * 200),
      deltaX: 0,
      deltaY: Math.round(variation),
    });
    await sleep(40 + Math.random() * 80);
  }
}

/** Simulate reading the page — random scroll and pauses */
async function simulateReading(sendCmd: SendCmdFn): Promise<void> {
  const scrollAmount = 200 + Math.floor(Math.random() * 400);
  await humanScroll(sendCmd, scrollAmount);
  await sleep(800 + Math.random() * 1500);

  if (Math.random() > 0.4) {
    await humanScroll(sendCmd, 150 + Math.floor(Math.random() * 300));
    await sleep(500 + Math.random() * 1000);
  }

  // Occasionally move mouse around as if scanning content
  if (Math.random() > 0.5) {
    const x1 = 200 + Math.floor(Math.random() * 600);
    const y1 = 200 + Math.floor(Math.random() * 300);
    const x2 = 300 + Math.floor(Math.random() * 500);
    const y2 = 100 + Math.floor(Math.random() * 400);
    await humanMouseMove(sendCmd, x1, y1, x2, y2);
    await sleep(300 + Math.random() * 700);
  }
}

// ─── Realistic Delays ────────────────────────────────

const humanDelay = {
  afterPageLoad: () => sleep(1500 + Math.random() * 2000),
  beforeClick: () => sleep(300 + Math.random() * 700),
  afterClick: () => sleep(500 + Math.random() * 1000),
  beforeSearch: () => sleep(800 + Math.random() * 1200),
  betweenProducts: () => sleep(2000 + Math.random() * 3000),
  beforeBuy: () => sleep(3000 + Math.random() * 5000),
  beforeType: () => sleep(300 + Math.random() * 400),
};

// ─── Session Fingerprint (rotated per session) ───────

let currentProfile = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
let currentViewport = VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];

function rotateFingerprint(): void {
  currentProfile = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  currentViewport = VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
}

// ─── Camada 3: Sessao Persistente (cookies) ──────────

interface CookieData {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: string;
}

/** Save cookies from current CDP session */
async function extractCookies(sendCmd: SendCmdFn): Promise<CookieData[]> {
  try {
    const result = await sendCmd("Network.getAllCookies");
    return ((result as any).cookies || []) as CookieData[];
  } catch {
    return [];
  }
}

/** Restore cookies into a CDP session */
async function restoreCookies(sendCmd: SendCmdFn, cookies: CookieData[]): Promise<void> {
  if (!cookies || cookies.length === 0) return;
  try {
    await sendCmd("Network.setCookies", { cookies });
  } catch (err) {
    console.error("[HumanBehavior] Failed to restore cookies:", err);
  }
}

// ─── Camada 3: Navegacao Realista ────────────────────

const REFERERS = [
  "https://www.google.com/",
  "https://www.google.com.br/",
  "https://www.google.com/search?q=",
  "",  // direct navigation (sometimes)
];

function getRandomReferer(searchTerm?: string): string {
  const idx = Math.floor(Math.random() * REFERERS.length);
  const ref = REFERERS[idx];
  if (ref.includes("search?q=") && searchTerm) {
    return ref + encodeURIComponent(searchTerm);
  }
  return ref;
}

// ─── Camada 4: Deteccao de Bloqueio ──────────────────

interface BlockDetectionResult {
  blocked: boolean;
  type: "captcha" | "bot_detection" | "rate_limit" | "auth" | null;
  description: string | null;
}

async function detectBlock(sendCmd: SendCmdFn): Promise<BlockDetectionResult> {
  try {
    const result = await sendCmd("Runtime.evaluate", {
      expression: `(() => {
        const body = document.body?.innerText?.toLowerCase() || '';
        const url = window.location.href.toLowerCase();
        const title = document.title.toLowerCase();

        // CAPTCHA detection
        if (
          document.querySelector('form[action*="captcha"]') ||
          document.querySelector('#captchacharacters') ||
          body.includes('enter the characters you see below') ||
          body.includes('type the characters') ||
          url.includes('/errors/validatecaptcha') ||
          body.includes('sorry, we just need to make sure')
        ) {
          return JSON.stringify({ blocked: true, type: 'captcha', description: 'CAPTCHA detected' });
        }

        // Bot detection / automated traffic
        if (
          body.includes('automated access') ||
          body.includes('unusual traffic') ||
          body.includes("we're sorry") && body.includes('not a robot') ||
          title.includes('robot check') ||
          body.includes('api-services-support@amazon.com') ||
          url.includes('/ref=cs_503_')
        ) {
          return JSON.stringify({ blocked: true, type: 'bot_detection', description: 'Bot detection triggered' });
        }

        // Rate limiting
        if (
          body.includes('too many requests') ||
          body.includes('service unavailable') ||
          body.includes('try again later')
        ) {
          return JSON.stringify({ blocked: true, type: 'rate_limit', description: 'Rate limited' });
        }

        // Auth required
        if (
          document.querySelector('#auth-mfa-otpcode') ||
          document.querySelector('#ap_password') ||
          url.includes('/ap/signin') ||
          url.includes('/ap/mfa')
        ) {
          return JSON.stringify({ blocked: true, type: 'auth', description: 'Authentication required' });
        }

        return JSON.stringify({ blocked: false, type: null, description: null });
      })()`,
      returnByValue: true,
    });
    return JSON.parse((result as any)?.result?.value ?? '{"blocked":false,"type":null,"description":null}');
  } catch {
    return { blocked: false, type: null, description: null };
  }
}

// ─── Exported Class ──────────────────────────────────

export class HumanBehavior {
  /**
   * Apply full anti-detection setup before navigation.
   * Call this ONCE per page WebSocket session, before Page.navigate.
   */
  static async applyStealthProfile(sendCmd: SendCmdFn): Promise<{
    userAgent: string;
    viewport: { width: number; height: number };
  }> {
    rotateFingerprint();

    // 1. User-Agent override with full client hints
    await sendCmd("Network.setUserAgentOverride", {
      userAgent: currentProfile.ua,
      acceptLanguage: "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      platform: currentProfile.platform,
      userAgentMetadata: {
        brands: currentProfile.brands,
        fullVersionList: currentProfile.brands,
        fullVersion: currentProfile.brands[0].version + ".0.6261.112",
        platform: currentProfile.platform === "Win32" ? "Windows" : "macOS",
        platformVersion: currentProfile.platform === "Win32" ? "15.0.0" : "14.5.0",
        architecture: "x86",
        model: "",
        mobile: false,
        bitness: "64",
        wow64: false,
      },
    });

    // 2. Set viewport/device metrics
    await sendCmd("Emulation.setDeviceMetricsOverride", {
      width: currentViewport.width,
      height: currentViewport.height,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: currentViewport.width,
      screenHeight: currentViewport.height,
    });

    // 3. Inject stealth script before any page loads
    await sendCmd("Page.addScriptToEvaluateOnNewDocument", {
      source: buildStealthScript(currentProfile, currentViewport),
    });

    // 4. Set geolocation to Brazil (Sao Paulo)
    await sendCmd("Emulation.setGeolocationOverride", {
      latitude: -23.5505,
      longitude: -46.6333,
      accuracy: 100,
    });

    // 5. Set timezone to Brazil
    await sendCmd("Emulation.setTimezoneOverride", {
      timezoneId: "America/Sao_Paulo",
    });

    // 6. Set locale
    await sendCmd("Emulation.setLocaleOverride", {
      locale: "pt-BR",
    }).catch(() => {
      // Not all Chrome versions support this
    });

    return {
      userAgent: currentProfile.ua,
      viewport: currentViewport,
    };
  }

  /**
   * Simulate human behavior after page loads.
   * Mouse movements, scrolling, reading pauses.
   */
  static async simulateAfterLoad(sendCmd: SendCmdFn): Promise<void> {
    await humanDelay.afterPageLoad();

    // Move mouse from a random starting point to center-ish area
    const startX = 100 + Math.floor(Math.random() * 200);
    const startY = 50 + Math.floor(Math.random() * 100);
    const endX = 400 + Math.floor(Math.random() * 400);
    const endY = 300 + Math.floor(Math.random() * 200);

    await humanMouseMove(sendCmd, startX, startY, endX, endY);
    await simulateReading(sendCmd);
  }

  /**
   * Navigate to homepage first, then to target URL.
   * More realistic than going directly to a search URL.
   */
  static async navigateWithHistory(
    sendCmd: SendCmdFn,
    targetUrl: string,
    searchTerm?: string
  ): Promise<void> {
    const shouldVisitHomepage = Math.random() > 0.4;

    if (shouldVisitHomepage && targetUrl.includes("amazon")) {
      // Set referer as if coming from Google
      const referer = getRandomReferer(searchTerm);
      if (referer) {
        await sendCmd("Network.setExtraHTTPHeaders", {
          headers: { Referer: referer },
        });
      }

      // Visit Amazon homepage first
      await sendCmd("Page.navigate", { url: "https://www.amazon.com.br/" });

      // Wait for page to load
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 3000 + Math.random() * 2000);
      });

      // Simulate looking at homepage
      await HumanBehavior.simulateAfterLoad(sendCmd);

      // Now navigate to actual target
      await sendCmd("Page.navigate", { url: targetUrl });
    } else {
      // Direct navigation with Google referer
      const referer = getRandomReferer(searchTerm);
      if (referer) {
        await sendCmd("Network.setExtraHTTPHeaders", {
          headers: { Referer: referer },
        });
      }
      await sendCmd("Page.navigate", { url: targetUrl });
    }
  }

  /**
   * Type text into focused element with human-like speed.
   */
  static async humanType(sendCmd: SendCmdFn, text: string): Promise<void> {
    await humanDelay.beforeType();
    await humanType(sendCmd, text);
  }

  /**
   * Click at coordinates with human mouse movement.
   */
  static async humanClick(
    sendCmd: SendCmdFn,
    x: number,
    y: number,
    fromX?: number,
    fromY?: number
  ): Promise<void> {
    await humanClick(sendCmd, x, y, fromX, fromY);
  }

  /**
   * Scroll to a target Y position with human-like increments.
   */
  static async humanScrollTo(
    sendCmd: SendCmdFn,
    targetY: number,
    currentY: number = 0
  ): Promise<void> {
    await humanScrollTo(sendCmd, targetY, currentY);
  }

  /**
   * Scroll by a delta amount with human-like increments.
   */
  static async humanScroll(sendCmd: SendCmdFn, deltaY: number): Promise<void> {
    await humanScroll(sendCmd, deltaY);
  }

  /**
   * Extract cookies from the current CDP session for persistence.
   */
  static async saveCookies(sendCmd: SendCmdFn): Promise<CookieData[]> {
    return extractCookies(sendCmd);
  }

  /**
   * Restore previously saved cookies into the CDP session.
   */
  static async restoreCookies(sendCmd: SendCmdFn, cookies: CookieData[]): Promise<void> {
    return restoreCookies(sendCmd, cookies);
  }

  /**
   * Detect if the page is blocked (CAPTCHA, bot detection, rate limit).
   */
  static async detectBlock(sendCmd: SendCmdFn): Promise<BlockDetectionResult> {
    return detectBlock(sendCmd);
  }

  /**
   * Full Amazon search flow with human behavior:
   * 1. Optional homepage visit
   * 2. Navigate to search URL
   * 3. Wait for load
   * 4. Simulate reading
   * 5. Detect blocks
   */
  static async amazonSearchFlow(
    sendCmd: SendCmdFn,
    searchTerm: string
  ): Promise<{ blocked: boolean; blockInfo?: BlockDetectionResult }> {
    // Simulate pre-search delay
    await humanDelay.beforeSearch();

    // Check for blocks
    const blockResult = await detectBlock(sendCmd);
    if (blockResult.blocked) {
      return { blocked: true, blockInfo: blockResult };
    }

    return { blocked: false };
  }

  /**
   * Get realistic delays for use in server.ts flow.
   */
  static get delays() {
    return humanDelay;
  }

  /**
   * Get current session fingerprint info (for logging).
   */
  static getSessionInfo(): { userAgent: string; viewport: string; platform: string } {
    return {
      userAgent: currentProfile.ua.substring(0, 60) + "...",
      viewport: `${currentViewport.width}x${currentViewport.height}`,
      platform: currentProfile.platform,
    };
  }
}
