/**
 * Composio Client — Singleton wrapper for the Composio SDK
 *
 * Provides centralized access to Composio actions:
 *  - Gmail (send, fetch)
 *  - Google Calendar (create event, list events)
 *  - Slack (send message)
 *
 * Setup:
 *  1. Set COMPOSIO_API_KEY in .env
 *  2. Run: npx tsx scripts/composio-setup.ts
 */

import { Composio } from "composio-core";

let client: Composio | null = null;

/**
 * Check if the Composio API key is configured.
 */
export function isComposioConfigured(): boolean {
  return !!process.env.COMPOSIO_API_KEY;
}

/**
 * Get the singleton Composio client instance.
 * Creates it on first call.
 */
export function getComposioClient(): Composio {
  if (!client) {
    if (!process.env.COMPOSIO_API_KEY) {
      throw new Error("COMPOSIO_API_KEY is not set");
    }
    client = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
  }
  return client;
}

/**
 * Execute a Composio action.
 * For apps requiring auth, a connected account must exist (created via setup script).
 * For no-auth apps, pass appName in options.
 */
export async function composioExecute(
  actionName: string,
  input: Record<string, unknown>,
  options?: {
    appName?: string;
    connectedAccountId?: string;
    entityId?: string;
  }
): Promise<{
  successful: boolean;
  data: Record<string, unknown>;
  error?: string;
}> {
  const c = getComposioClient();

  const requestBody: Record<string, unknown> = { input };

  if (options?.appName) requestBody.appName = options.appName;
  if (options?.connectedAccountId) requestBody.connectedAccountId = options.connectedAccountId;
  if (options?.entityId) requestBody.entityId = options.entityId;

  const res = await c.actions.execute({ actionName, requestBody });

  return {
    successful: (res as any)?.successful ?? (res as any)?.successfull ?? false,
    data: (res as any)?.data ?? {},
    error: (res as any)?.error ?? undefined,
  };
}

/**
 * List available actions for a given app on Composio.
 */
export async function composioListActions(appName: string): Promise<string[]> {
  const c = getComposioClient();
  const res = await c.actions.list({ apps: appName });
  const items = (res as any).items || res;
  return Array.isArray(items) ? items.map((a: any) => a.name) : [];
}

/**
 * Check if a connected account exists for the given app.
 */
export async function hasConnectedAccount(appName: string): Promise<boolean> {
  if (!isComposioConfigured()) return false;
  try {
    const c = getComposioClient();
    const conns = await c.connectedAccounts.list({});
    const items = (conns as any).items || conns;
    return Array.isArray(items) && items.some((conn: any) =>
      (conn.appName || "").toLowerCase() === appName.toLowerCase() &&
      conn.status === "ACTIVE"
    );
  } catch {
    return false;
  }
}
