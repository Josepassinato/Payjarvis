import { prisma } from "@payjarvis/database";
import { logEvent, AuditEvents } from "./audit-logger.js";
import { notifyApprovalCreated } from "../services/notifications.js";
import { updateTrustScore } from "../services/trust-score.js";

// ─── Types ───

export interface ApprovalAction {
  type: string;
  amount: number;
  merchantName: string;
  category: string;
  transactionId: string;
  merchantId?: string;
}

export interface ApprovalResult {
  approvalId: string;
  expiresAt: Date;
}

const APPROVAL_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Create a new approval request and notify the owner via Telegram.
 */
export async function requestApproval(
  botId: string,
  userId: string,
  action: ApprovalAction
): Promise<ApprovalResult> {
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS);

  // Resolve agent if exists
  const agent = await prisma.agent.findUnique({ where: { botId } });
  const bot = await prisma.bot.findUnique({ where: { id: botId } });

  const approval = await prisma.approvalRequest.create({
    data: {
      transactionId: action.transactionId,
      botId,
      agentId: agent?.id ?? null,
      ownerId: userId,
      amount: action.amount,
      merchantName: action.merchantName,
      category: action.category,
      status: "PENDING",
      expiresAt,
    },
  });

  // Send notification
  await notifyApprovalCreated(userId, {
    botName: bot?.name ?? botId,
    amount: action.amount,
    merchantName: action.merchantName,
    approvalId: approval.id,
  });

  await logEvent({
    botId,
    userId,
    event: AuditEvents.APPROVAL_REQUESTED,
    layer: 1,
    payload: {
      approvalId: approval.id,
      transactionId: action.transactionId,
      amount: action.amount,
      merchantName: action.merchantName,
      category: action.category,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return { approvalId: approval.id, expiresAt };
}

/**
 * Approve a pending approval request.
 */
export async function approve(
  approvalId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const approval = await prisma.approvalRequest.findUnique({
    where: { id: approvalId },
  });

  if (!approval) return { success: false, error: "Approval not found" };
  if (approval.ownerId !== userId) return { success: false, error: "Unauthorized" };
  if (approval.status !== "PENDING") return { success: false, error: `Approval already ${approval.status}` };

  if (new Date() > approval.expiresAt) {
    await prisma.approvalRequest.update({
      where: { id: approvalId },
      data: { status: "EXPIRED" },
    });
    return { success: false, error: "Approval has expired" };
  }

  await prisma.approvalRequest.update({
    where: { id: approvalId },
    data: { status: "APPROVED", respondedAt: new Date() },
  });

  await prisma.transaction.update({
    where: { id: approval.transactionId },
    data: { decision: "APPROVED", approvedByHuman: true, decisionReason: "Approved by owner" },
  });

  await updateTrustScore(approval.botId, "APPROVED", null, true, userId, approval.amount);

  await logEvent({
    botId: approval.botId,
    userId,
    event: AuditEvents.APPROVAL_GRANTED,
    layer: 1,
    payload: {
      approvalId,
      transactionId: approval.transactionId,
      amount: approval.amount,
    },
  });

  return { success: true };
}

/**
 * Reject a pending approval request.
 */
export async function reject(
  approvalId: string,
  userId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const approval = await prisma.approvalRequest.findUnique({
    where: { id: approvalId },
  });

  if (!approval) return { success: false, error: "Approval not found" };
  if (approval.ownerId !== userId) return { success: false, error: "Unauthorized" };
  if (approval.status !== "PENDING") return { success: false, error: `Approval already ${approval.status}` };

  await prisma.approvalRequest.update({
    where: { id: approvalId },
    data: { status: "REJECTED", respondedAt: new Date() },
  });

  await prisma.transaction.update({
    where: { id: approval.transactionId },
    data: { decision: "BLOCKED", decisionReason: reason ?? "Rejected by owner" },
  });

  await updateTrustScore(approval.botId, "BLOCKED", null, false, userId, approval.amount);

  await logEvent({
    botId: approval.botId,
    userId,
    event: AuditEvents.APPROVAL_DENIED,
    layer: 1,
    payload: {
      approvalId,
      transactionId: approval.transactionId,
      amount: approval.amount,
      reason: reason ?? "Rejected by owner",
    },
  });

  return { success: true };
}

/**
 * Find and expire all PENDING approval requests past their expiresAt.
 */
export async function checkTimeouts(): Promise<number> {
  try {
    const expired = await prisma.approvalRequest.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
    });

    for (const approval of expired) {
      await prisma.approvalRequest.update({
        where: { id: approval.id },
        data: { status: "EXPIRED" },
      });

      await prisma.transaction.update({
        where: { id: approval.transactionId },
        data: { decision: "BLOCKED", decisionReason: "Approval expired — auto-blocked" },
      });

      await updateTrustScore(approval.botId, "BLOCKED", "approval_timeout", false, "system");

      await logEvent({
        botId: approval.botId,
        event: AuditEvents.APPROVAL_TIMEOUT,
        layer: 1,
        payload: {
          approvalId: approval.id,
          transactionId: approval.transactionId,
          amount: approval.amount,
        },
      });
    }

    return expired.length;
  } catch (err) {
    console.error("[ApprovalManager] checkTimeouts error:", err);
    return 0;
  }
}

// ─── Background timeout checker (every 60s) ───

let _timeoutInterval: ReturnType<typeof setInterval> | null = null;

export function startTimeoutChecker(): void {
  if (_timeoutInterval) return;
  _timeoutInterval = setInterval(checkTimeouts, 60_000);
  // Run once immediately after a short delay
  setTimeout(checkTimeouts, 5_000);
}

export function stopTimeoutChecker(): void {
  if (_timeoutInterval) {
    clearInterval(_timeoutInterval);
    _timeoutInterval = null;
  }
}
