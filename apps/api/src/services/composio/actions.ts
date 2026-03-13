/**
 * Composio Actions — High-level wrappers for common Composio integrations
 *
 * Each function:
 *  1. Checks if Composio is configured
 *  2. Calls composioExecute with the appropriate action
 *  3. Returns { success, data, error? }
 */

import {
  composioExecute,
  isComposioConfigured,
} from "./composio-client.js";

interface ActionResult {
  success: boolean;
  data: Record<string, unknown>;
  error?: string;
}

// ─── Gmail ──────────────────────────────────────────────────────

/**
 * Send an email via Gmail through Composio.
 */
export async function sendConfirmationEmail(
  botId: string,
  params: { to: string; subject: string; body: string }
): Promise<ActionResult> {
  if (!isComposioConfigured()) {
    return { success: false, data: {}, error: "Composio not configured" };
  }

  try {
    const result = await composioExecute(
      "GMAIL_SEND_EMAIL",
      {
        recipient_email: params.to,
        subject: params.subject,
        body: params.body,
      },
      { entityId: botId }
    );

    return {
      success: result.successful,
      data: result.data,
      error: result.error,
    };
  } catch (err: any) {
    return {
      success: false,
      data: {},
      error: err.message ?? "Failed to send email",
    };
  }
}

/**
 * Fetch emails from Gmail via Composio.
 */
export async function fetchEmails(
  botId: string,
  params: { query?: string; maxResults?: number }
): Promise<ActionResult> {
  if (!isComposioConfigured()) {
    return { success: false, data: {}, error: "Composio not configured" };
  }

  try {
    const result = await composioExecute(
      "GMAIL_FETCH_EMAILS",
      {
        query: params.query ?? "is:inbox",
        max_results: params.maxResults ?? 10,
      },
      { entityId: botId }
    );

    return {
      success: result.successful,
      data: result.data,
      error: result.error,
    };
  } catch (err: any) {
    return {
      success: false,
      data: {},
      error: err.message ?? "Failed to fetch emails",
    };
  }
}

// ─── Google Calendar ────────────────────────────────────────────

/**
 * Create a calendar event via Google Calendar through Composio.
 */
export async function createCalendarEvent(
  botId: string,
  params: {
    title: string;
    startTime: string;
    endTime: string;
    description?: string;
  }
): Promise<ActionResult> {
  if (!isComposioConfigured()) {
    return { success: false, data: {}, error: "Composio not configured" };
  }

  try {
    const result = await composioExecute(
      "GOOGLECALENDAR_CREATE_EVENT",
      {
        summary: params.title,
        start_datetime: params.startTime,
        end_datetime: params.endTime,
        description: params.description ?? "",
      },
      { entityId: botId }
    );

    return {
      success: result.successful,
      data: result.data,
      error: result.error,
    };
  } catch (err: any) {
    return {
      success: false,
      data: {},
      error: err.message ?? "Failed to create calendar event",
    };
  }
}

/**
 * List calendar events via Google Calendar through Composio.
 */
export async function listCalendarEvents(
  botId: string,
  params: { timeMin?: string; timeMax?: string }
): Promise<ActionResult> {
  if (!isComposioConfigured()) {
    return { success: false, data: {}, error: "Composio not configured" };
  }

  try {
    const input: Record<string, unknown> = {};
    if (params.timeMin) input.time_min = params.timeMin;
    if (params.timeMax) input.time_max = params.timeMax;

    const result = await composioExecute(
      "GOOGLECALENDAR_LIST_EVENTS",
      input,
      { entityId: botId }
    );

    return {
      success: result.successful,
      data: result.data,
      error: result.error,
    };
  } catch (err: any) {
    return {
      success: false,
      data: {},
      error: err.message ?? "Failed to list calendar events",
    };
  }
}

// ─── Slack ──────────────────────────────────────────────────────

/**
 * Send a notification via Slack through Composio.
 * Falls back to console.log if Composio is not configured.
 */
export async function sendNotification(
  botId: string,
  params: { message: string; channel?: string }
): Promise<ActionResult> {
  if (!isComposioConfigured()) {
    // Fallback: log to console when Composio is not available
    console.log(
      `[Composio Fallback] Notification for bot ${botId}: ${params.message}` +
      (params.channel ? ` (channel: ${params.channel})` : "")
    );
    return {
      success: true,
      data: { fallback: true, logged: true },
      error: undefined,
    };
  }

  try {
    const input: Record<string, unknown> = {
      text: params.message,
    };
    if (params.channel) input.channel = params.channel;

    const result = await composioExecute(
      "SLACK_SEND_MESSAGE",
      input,
      { entityId: botId }
    );

    return {
      success: result.successful,
      data: result.data,
      error: result.error,
    };
  } catch (err: any) {
    // Fallback to console on error
    console.log(
      `[Composio Fallback] Notification for bot ${botId}: ${params.message}` +
      (params.channel ? ` (channel: ${params.channel})` : "")
    );
    return {
      success: false,
      data: { fallback: true, logged: true },
      error: err.message ?? "Failed to send Slack notification, logged to console",
    };
  }
}
