/**
 * Browserbase Client — Singleton wrapper around the Browserbase SDK
 *
 * Manages cloud browser sessions for assisted fallback and human handoff.
 */

import Browserbase from "@browserbasehq/sdk";
import type {
  Session,
  SessionCreateParams,
  SessionCreateResponse,
  SessionLiveURLs,
  SessionRetrieveResponse,
  SessionListResponse,
} from "@browserbasehq/sdk/resources/sessions/sessions.js";

// ─── Singleton ───────────────────────────────────────

let _client: Browserbase | null = null;

function getClient(): Browserbase {
  if (!_client) {
    const apiKey = process.env.BROWSERBASE_API_KEY;
    if (!apiKey) {
      throw new Error("BROWSERBASE_API_KEY is not set");
    }
    _client = new Browserbase({ apiKey });
  }
  return _client;
}

// ─── Public API ──────────────────────────────────────

export interface CreateSessionOptions {
  projectId?: string;
  keepAlive?: boolean;
  proxies?: boolean;
  browserSettings?: SessionCreateParams["browserSettings"];
  timeout?: number;
  region?: SessionCreateParams["region"];
}

export interface CreateSessionResult {
  sessionId: string;
  connectUrl: string;
  session: SessionCreateResponse;
}

/**
 * Create a new Browserbase cloud browser session.
 */
export async function createSession(
  options?: CreateSessionOptions
): Promise<CreateSessionResult> {
  const client = getClient();
  const projectId =
    options?.projectId ?? process.env.BROWSERBASE_PROJECT_ID;

  const params: SessionCreateParams = {
    projectId,
    keepAlive: options?.keepAlive ?? true,
    timeout: options?.timeout ?? 300, // 5 minutes default
    browserSettings: options?.browserSettings ?? {
      blockAds: true,
    },
  };

  if (options?.proxies !== undefined) {
    params.proxies = options.proxies;
  }

  if (options?.region) {
    params.region = options.region;
  }

  const session = await client.sessions.create(params);

  return {
    sessionId: session.id,
    connectUrl: session.connectUrl,
    session,
  };
}

/**
 * Retrieve details for an existing session.
 */
export async function getSession(
  sessionId: string
): Promise<SessionRetrieveResponse> {
  const client = getClient();
  return client.sessions.retrieve(sessionId);
}

/**
 * Get live debug URLs for a session (debugger view for the user to watch/interact).
 */
export async function getSessionLiveURLs(
  sessionId: string
): Promise<SessionLiveURLs> {
  const client = getClient();
  return client.sessions.debug(sessionId);
}

/**
 * Close a session by requesting release.
 */
export async function closeSession(sessionId: string): Promise<Session> {
  const client = getClient();
  return client.sessions.update(sessionId, {
    status: "REQUEST_RELEASE",
  });
}

/**
 * List active (RUNNING) sessions.
 */
export async function listActiveSessions(): Promise<SessionListResponse> {
  const client = getClient();
  return client.sessions.list({ status: "RUNNING" });
}

/**
 * Check if Browserbase is properly configured.
 */
export function isConfigured(): boolean {
  return !!(
    process.env.BROWSERBASE_API_KEY &&
    process.env.BROWSERBASE_PROJECT_ID
  );
}

// Re-export types for convenience
export type {
  Session,
  SessionCreateResponse,
  SessionLiveURLs,
  SessionRetrieveResponse,
  SessionListResponse,
};
