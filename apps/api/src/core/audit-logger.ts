import { prisma } from "@payjarvis/database";

// ─── Event type constants ───

export const AuditEvents = {
  BOT_ACTION_REQUESTED: "BOT_ACTION_REQUESTED",
  POLICY_DECISION: "POLICY_DECISION",
  APPROVAL_REQUESTED: "APPROVAL_REQUESTED",
  APPROVAL_GRANTED: "APPROVAL_GRANTED",
  APPROVAL_DENIED: "APPROVAL_DENIED",
  APPROVAL_TIMEOUT: "APPROVAL_TIMEOUT",
  API_CALL_MADE: "API_CALL_MADE",
  COMPOSIO_ACTION: "COMPOSIO_ACTION",
  BROWSERBASE_SESSION: "BROWSERBASE_SESSION",
  PAYMENT_INITIATED: "PAYMENT_INITIATED",
  PAYMENT_COMPLETED: "PAYMENT_COMPLETED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  INSTANCE_SPAWNED: "INSTANCE_SPAWNED",
  USER_ASSIGNED: "USER_ASSIGNED",
} as const;

export type AuditEventType = (typeof AuditEvents)[keyof typeof AuditEvents];

export interface AuditEvent {
  botId?: string;
  userId?: string;
  event: string;
  layer: 1 | 2 | 3 | 4;
  payload?: Record<string, unknown>;
}

/**
 * Centralized immutable logging.
 * Writes to AuditLog Prisma model with layer information embedded in payload.
 * Never throws — errors are logged to console.
 */
export async function logEvent(event: AuditEvent): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entityType: event.botId ? "bot" : "system",
        entityId: event.botId ?? event.userId ?? "system",
        action: event.event,
        actorType: event.botId ? "bot" : event.userId ? "user" : "system",
        actorId: event.botId ?? event.userId ?? "system",
        payload: {
          layer: event.layer,
          ...(event.payload ?? {}),
        },
      },
    });
  } catch (err) {
    console.error("[AuditLogger] Failed to log event:", event.event, err);
  }
}
