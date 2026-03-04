import type { FastifyInstance } from "fastify";
import { prisma } from "@payjarvis/database";
import { BditIssuer } from "@payjarvis/bdit";
import { requireAuth } from "../middleware/auth.js";
import { createAuditLog } from "../services/audit.js";
import { updateTrustScore } from "../services/trust-score.js";
import { randomUUID } from "node:crypto";
import { emitApprovalEvent } from "./approvals.js";

export async function paymentRoutes(app: FastifyInstance) {
  const issuer = new BditIssuer(
    (process.env.PAYJARVIS_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    process.env.PAYJARVIS_KEY_ID ?? "payjarvis-key-001"
  );

  // Request payment — calls rules engine, emits BDIT if approved, creates ApprovalRequest if pending
  app.post("/bots/:botId/request-payment", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const { botId } = request.params as { botId: string };
    const { merchantId, merchantName, amount, currency, category } = request.body as {
      merchantId: string;
      merchantName: string;
      amount: number;
      currency?: string;
      category: string;
    };

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return reply.status(404).send({ success: false, error: "User not found" });

    const bot = await prisma.bot.findFirst({
      where: { id: botId, ownerId: user.id },
      include: { policy: true },
    });
    if (!bot) return reply.status(404).send({ success: false, error: "Bot not found" });
    if (bot.status !== "ACTIVE") {
      return reply.status(403).send({ success: false, error: "Bot is not active" });
    }

    const policy = bot.policy;
    if (!policy) {
      return reply.status(400).send({ success: false, error: "Bot has no policy configured" });
    }

    // Call rules engine
    const rulesEngineUrl = process.env.RULES_ENGINE_URL ?? "http://localhost:3002";
    const rulesResponse = await fetch(`${rulesEngineUrl}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        botId: bot.id,
        ownerId: user.id,
        merchantId,
        merchantName,
        amount,
        category,
        policy: {
          maxPerTransaction: policy.maxPerTransaction,
          maxPerDay: policy.maxPerDay,
          maxPerWeek: policy.maxPerWeek,
          maxPerMonth: policy.maxPerMonth,
          autoApproveLimit: policy.autoApproveLimit,
          requireApprovalUp: policy.requireApprovalUp,
          allowedDays: policy.allowedDays,
          allowedHoursStart: policy.allowedHoursStart,
          allowedHoursEnd: policy.allowedHoursEnd,
          allowedCategories: policy.allowedCategories,
          blockedCategories: policy.blockedCategories,
          merchantWhitelist: policy.merchantWhitelist,
          merchantBlacklist: policy.merchantBlacklist,
        },
        botTrustScore: bot.trustScore,
      }),
    });

    const rulesResult = await rulesResponse.json() as {
      decision: string;
      reason: string;
      ruleTriggered: string | null;
    };

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        botId: bot.id,
        ownerId: user.id,
        merchantId,
        merchantName,
        amount,
        currency: currency ?? "BRL",
        category,
        decision: rulesResult.decision as any,
        decisionReason: rulesResult.reason,
      },
    });

    await createAuditLog({
      entityType: "transaction",
      entityId: transaction.id,
      action: "CREATE",
      actorType: "bot",
      actorId: bot.id,
      payload: { decision: rulesResult.decision, amount, merchantName },
      ipAddress: request.ip,
    });

    // Handle decision
    if (rulesResult.decision === "APPROVED") {
      // Issue BDIT token
      const { token, jti, expiresAt } = await issuer.issue({
        botId: bot.id,
        ownerId: user.id,
        trustScore: bot.trustScore,
        categories: policy.allowedCategories,
        maxAmount: policy.maxPerTransaction,
        merchantId,
        amount,
        category,
        sessionId: randomUUID(),
      });

      // Save BDIT token record
      await prisma.bditToken.create({
        data: { jti, botId: bot.id, amount, category, expiresAt },
      });

      // Update transaction with BDIT jti
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { bdtJti: jti },
      });

      // Update bot stats
      await prisma.bot.update({
        where: { id: bot.id },
        data: { totalApproved: { increment: 1 } },
      });

      // Update trust score
      await updateTrustScore(bot.id, "APPROVED", null, false, user.id);

      return {
        success: true,
        data: {
          decision: "APPROVED",
          transactionId: transaction.id,
          bditToken: token,
          expiresAt: expiresAt.toISOString(),
        },
      };
    }

    if (rulesResult.decision === "PENDING_HUMAN") {
      // Create approval request
      const approval = await prisma.approvalRequest.create({
        data: {
          transactionId: transaction.id,
          botId: bot.id,
          ownerId: user.id,
          amount,
          merchantName,
          category,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        },
      });

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { approvalId: approval.id },
      });

      // Emit SSE event for new approval
      emitApprovalEvent(user.id, "approval_created", {
        id: approval.id,
        botId: bot.id,
        amount,
        merchantName,
        category,
        expiresAt: approval.expiresAt.toISOString(),
      });

      return {
        success: true,
        data: {
          decision: "PENDING_HUMAN",
          transactionId: transaction.id,
          approvalId: approval.id,
          reason: rulesResult.reason,
          expiresAt: approval.expiresAt.toISOString(),
        },
      };
    }

    // BLOCKED
    await prisma.bot.update({
      where: { id: bot.id },
      data: { totalBlocked: { increment: 1 } },
    });

    // Update trust score
    await updateTrustScore(bot.id, "BLOCKED", rulesResult.ruleTriggered, false, user.id);

    return {
      success: true,
      data: {
        decision: "BLOCKED",
        transactionId: transaction.id,
        reason: rulesResult.reason,
        ruleTriggered: rulesResult.ruleTriggered,
      },
    };
  });
}
