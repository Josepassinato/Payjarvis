/**
 * Composio Routes — /api/composio/*
 *
 * Endpoints for Composio tool integrations (Gmail, Google Calendar, Slack).
 * Public endpoint for listing tools; authenticated endpoints for actions.
 */

import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import {
  isComposioConfigured,
  composioListActions,
  hasConnectedAccount,
  getComposioClient,
  sendConfirmationEmail,
  createCalendarEvent,
  sendNotification,
} from "../services/composio/index.js";

// Supported apps and their display info
const SUPPORTED_APPS = [
  { name: "gmail", label: "Gmail", actions: ["GMAIL_SEND_EMAIL", "GMAIL_FETCH_EMAILS"] },
  { name: "googlecalendar", label: "Google Calendar", actions: ["GOOGLECALENDAR_CREATE_EVENT", "GOOGLECALENDAR_LIST_EVENTS"] },
  { name: "slack", label: "Slack", actions: ["SLACK_SEND_MESSAGE"] },
];

export async function composioRoutes(app: FastifyInstance) {
  // ─── List available tools (public) ────────────────────────
  app.get(
    "/api/composio/tools",
    async (_request, _reply) => {
      const configured = isComposioConfigured();

      if (!configured) {
        return {
          success: true,
          configured: false,
          tools: SUPPORTED_APPS.map((a) => ({
            app: a.name,
            label: a.label,
            actions: a.actions,
            connected: false,
          })),
        };
      }

      // Check connections for each app
      const tools = await Promise.all(
        SUPPORTED_APPS.map(async (a) => {
          let connected = false;
          let liveActions: string[] = a.actions;
          try {
            connected = await hasConnectedAccount(a.name);
            const fetched = await composioListActions(a.name);
            if (fetched.length > 0) liveActions = fetched;
          } catch {
            // Use defaults on error
          }
          return {
            app: a.name,
            label: a.label,
            actions: liveActions,
            connected,
          };
        })
      );

      return { success: true, configured: true, tools };
    }
  );

  // ─── Initiate OAuth connection for an app (auth required) ─
  app.post(
    "/api/composio/connect/:app",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = (request as any).userId as string;
      const { app: appName } = request.params as { app: string };

      if (!isComposioConfigured()) {
        return reply.status(503).send({
          success: false,
          error: "Composio is not configured on this server",
        });
      }

      const validApps = SUPPORTED_APPS.map((a) => a.name);
      if (!validApps.includes(appName.toLowerCase())) {
        return reply.status(400).send({
          success: false,
          error: `Unsupported app: ${appName}. Supported: ${validApps.join(", ")}`,
        });
      }

      try {
        const client = getComposioClient();

        // Check if already connected
        const already = await hasConnectedAccount(appName);
        if (already) {
          return {
            success: true,
            status: "already_connected",
            app: appName,
          };
        }

        // Initiate connection — Composio returns a redirect URL for OAuth
        const entity = client.getEntity(userId);
        const connection = await entity.initiateConnection({ appName });

        return {
          success: true,
          status: "pending",
          app: appName,
          redirectUrl: (connection as any).redirectUrl ?? (connection as any).connectionStatus ?? null,
          connectionId: (connection as any).connectedAccountId ?? null,
        };
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: err.message ?? "Failed to initiate connection",
        });
      }
    }
  );

  // ─── List user's active connections (auth required) ───────
  app.get(
    "/api/composio/connections",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      if (!isComposioConfigured()) {
        return reply.status(503).send({
          success: false,
          error: "Composio is not configured on this server",
        });
      }

      try {
        const client = getComposioClient();
        const conns = await client.connectedAccounts.list({});
        const items = (conns as any).items || conns;

        const connections = Array.isArray(items)
          ? items
              .filter((c: any) => c.status === "ACTIVE")
              .map((c: any) => ({
                id: c.id,
                app: c.appName,
                status: c.status,
                createdAt: c.createdAt,
              }))
          : [];

        return { success: true, connections };
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: err.message ?? "Failed to list connections",
        });
      }
    }
  );

  // ─── Send email via Composio (auth required) ──────────────
  app.post(
    "/api/composio/actions/email",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = (request as any).userId as string;
      const body = request.body as {
        to?: string;
        subject?: string;
        body?: string;
      };

      if (!body.to || !body.subject || !body.body) {
        return reply.status(400).send({
          success: false,
          error: "to, subject, and body are required",
        });
      }

      const result = await sendConfirmationEmail(userId, {
        to: body.to,
        subject: body.subject,
        body: body.body,
      });

      if (!result.success) {
        return reply.status(result.error === "Composio not configured" ? 503 : 500).send(result);
      }

      return result;
    }
  );

  // ─── Create calendar event via Composio (auth required) ───
  app.post(
    "/api/composio/actions/calendar",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = (request as any).userId as string;
      const body = request.body as {
        title?: string;
        startTime?: string;
        endTime?: string;
        description?: string;
      };

      if (!body.title || !body.startTime || !body.endTime) {
        return reply.status(400).send({
          success: false,
          error: "title, startTime, and endTime are required",
        });
      }

      const result = await createCalendarEvent(userId, {
        title: body.title,
        startTime: body.startTime,
        endTime: body.endTime,
        description: body.description,
      });

      if (!result.success) {
        return reply.status(result.error === "Composio not configured" ? 503 : 500).send(result);
      }

      return result;
    }
  );

  // ─── Send notification via Composio/Slack (auth required) ─
  app.post(
    "/api/composio/actions/notify",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const userId = (request as any).userId as string;
      const body = request.body as {
        message?: string;
        channel?: string;
      };

      if (!body.message) {
        return reply.status(400).send({
          success: false,
          error: "message is required",
        });
      }

      const result = await sendNotification(userId, {
        message: body.message,
        channel: body.channel,
      });

      // sendNotification always returns success (falls back to console.log)
      return result;
    }
  );
}
