import type { FastifyInstance } from "fastify";
import { prisma } from "@payjarvis/database";
import { createAuditLog } from "../services/audit.js";
import { updateTrustScore } from "../services/trust-score.js";
import { redisExists, redisSetNX, redisDel } from "../services/redis.js";
import { createHash } from "node:crypto";

export async function merchantRoutes(app: FastifyInstance) {
  // POST /merchant/confirm — mark BDIT token as used
  app.post("/merchant/confirm", async (request, reply) => {
    const merchantKey = request.headers["x-merchant-key"] as string | undefined;
    if (!merchantKey) {
      return reply.status(401).send({ success: false, error: "Missing X-Merchant-Key header" });
    }

    const { jti, orderId, amountCharged } = request.body as {
      jti: string;
      orderId?: string;
      amountCharged?: number;
    };

    if (!jti) {
      return reply.status(400).send({ success: false, error: "jti is required" });
    }

    // Verify merchant key
    const keyHash = createHash("sha256").update(merchantKey).digest("hex");
    const merchant = await prisma.merchant.findFirst({ where: { apiKeyHash: keyHash } });
    if (!merchant) {
      return reply.status(401).send({ success: false, error: "Invalid merchant key" });
    }

    // Atomic gate: only one request can claim this token
    const claimed = await redisSetNX(`bdit:used:${jti}`, "1", 600);
    if (!claimed) {
      return reply.status(409).send({ success: false, error: "Token already used" });
    }

    // Find the token
    const token = await prisma.bditToken.findUnique({ where: { jti } });
    if (!token) {
      await redisDel(`bdit:used:${jti}`);
      return reply.status(404).send({ success: false, error: "Token not found" });
    }

    if (token.status === "USED") {
      return reply.status(409).send({ success: false, error: "Token already used" });
    }

    if (token.status === "EXPIRED" || token.expiresAt < new Date()) {
      await redisDel(`bdit:used:${jti}`);
      return reply.status(409).send({ success: false, error: "Token expired" });
    }

    // Mark as used in database
    await prisma.bditToken.update({
      where: { jti },
      data: { status: "USED", usedAt: new Date(), merchantId: merchant.id },
    });

    await createAuditLog({
      entityType: "bdit",
      entityId: jti,
      action: "bdit.used",
      actorType: "merchant",
      actorId: merchant.id,
      payload: { botId: token.botId, amount: token.amount, orderId, amountCharged },
    });

    // Trust score bonus for successful use
    await updateTrustScore(token.botId, "APPROVED", null, false, merchant.id);

    return {
      success: true,
      data: { jti, status: "USED", usedAt: new Date().toISOString() },
    };
  });
}
