import type { FastifyInstance } from "fastify";
import { prisma } from "@payjarvis/database";
import { BditIssuer } from "@payjarvis/bdit";
import { requireAuth } from "../middleware/auth.js";
import { createAuditLog } from "../services/audit.js";
import { updateTrustScore } from "../services/trust-score.js";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

const approvalEvents = new EventEmitter();
approvalEvents.setMaxListeners(100);

export function emitApprovalEvent(ownerId: string, event: string, data: unknown) {
  approvalEvents.emit(`approval:${ownerId}`, { event, data });
}

export async function approvalRoutes(app: FastifyInstance) {
  const issuer = new BditIssuer(
    (process.env.PAYJARVIS_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    process.env.PAYJARVIS_KEY_ID ?? "payjarvis-key-001"
  );

  // SSE stream for real-time approval updates
  app.get("/approvals/stream", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return reply.status(404).send({ success: false, error: "User not found" });

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const send = (eventName: string, data: unknown) => {
      reply.raw.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial data
    send("connected", { message: "SSE connected" });

    // Heartbeat every 15s
    const heartbeat = setInterval(() => {
      reply.raw.write(": heartbeat\n\n");
    }, 15000);

    // Listen for approval events for this user
    const listener = (payload: { event: string; data: unknown }) => {
      send(payload.event, payload.data);
    };
    approvalEvents.on(`approval:${user.id}`, listener);

    // Cleanup on disconnect
    request.raw.on("close", () => {
      clearInterval(heartbeat);
      approvalEvents.off(`approval:${user.id}`, listener);
    });
  });

  // Respond to approval request
  app.post("/approvals/:id/respond", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const { id } = request.params as { id: string };
    const { action, reason } = request.body as { action: "approve" | "reject"; reason?: string };

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return reply.status(404).send({ success: false, error: "User not found" });

    const approval = await prisma.approvalRequest.findFirst({
      where: { id, ownerId: user.id },
      include: { transaction: true, bot: { include: { policy: true } } },
    });

    if (!approval) return reply.status(404).send({ success: false, error: "Approval request not found" });

    if (approval.status !== "PENDING") {
      return reply.status(400).send({ success: false, error: `Approval already ${approval.status}` });
    }

    if (new Date() > approval.expiresAt) {
      await prisma.approvalRequest.update({
        where: { id },
        data: { status: "EXPIRED" },
      });
      return reply.status(400).send({ success: false, error: "Approval request has expired" });
    }

    if (action === "approve") {
      await prisma.approvalRequest.update({
        where: { id },
        data: { status: "APPROVED", respondedAt: new Date() },
      });

      const policy = approval.bot.policy!;
      const { token, jti, expiresAt } = await issuer.issue({
        botId: approval.botId,
        ownerId: user.id,
        trustScore: approval.bot.trustScore,
        categories: policy.allowedCategories,
        maxAmount: policy.maxPerTransaction,
        merchantId: approval.transaction.merchantId ?? "",
        amount: approval.amount,
        category: approval.category,
        sessionId: randomUUID(),
      });

      await prisma.bditToken.create({
        data: {
          jti,
          botId: approval.botId,
          amount: approval.amount,
          category: approval.category,
          expiresAt,
        },
      });

      await prisma.transaction.update({
        where: { id: approval.transactionId },
        data: {
          decision: "APPROVED",
          approvedByHuman: true,
          bdtJti: jti,
          decisionReason: reason ?? "Approved by owner",
        },
      });

      await prisma.bot.update({
        where: { id: approval.botId },
        data: { totalApproved: { increment: 1 } },
      });

      // Update trust score
      await updateTrustScore(approval.botId, "APPROVED", null, true, user.id);

      await createAuditLog({
        entityType: "approval",
        entityId: id,
        action: "APPROVE",
        actorType: "user",
        actorId: user.id,
        payload: { transactionId: approval.transactionId, amount: approval.amount },
        ipAddress: request.ip,
      });

      // Emit SSE event
      emitApprovalEvent(user.id, "approval_responded", {
        id,
        status: "APPROVED",
        transactionId: approval.transactionId,
      });

      return {
        success: true,
        data: {
          status: "APPROVED",
          bditToken: token,
          expiresAt: expiresAt.toISOString(),
        },
      };
    }

    // Reject
    await prisma.approvalRequest.update({
      where: { id },
      data: { status: "REJECTED", respondedAt: new Date() },
    });

    await prisma.transaction.update({
      where: { id: approval.transactionId },
      data: {
        decision: "BLOCKED",
        decisionReason: reason ?? "Rejected by owner",
      },
    });

    await prisma.bot.update({
      where: { id: approval.botId },
      data: { totalBlocked: { increment: 1 } },
    });

    // Update trust score
    await updateTrustScore(approval.botId, "BLOCKED", null, false, user.id);

    await createAuditLog({
      entityType: "approval",
      entityId: id,
      action: "REJECT",
      actorType: "user",
      actorId: user.id,
      payload: { transactionId: approval.transactionId, reason },
      ipAddress: request.ip,
    });

    // Emit SSE event
    emitApprovalEvent(user.id, "approval_responded", {
      id,
      status: "REJECTED",
      transactionId: approval.transactionId,
    });

    return {
      success: true,
      data: { status: "REJECTED" },
    };
  });

  // List pending approvals
  app.get("/approvals", { preHandler: [requireAuth] }, async (request) => {
    const userId = (request as any).userId as string;
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return { success: false, error: "User not found" };

    const approvals = await prisma.approvalRequest.findMany({
      where: { ownerId: user.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: approvals };
  });
}
