import type { FastifyInstance } from "fastify";
import { prisma } from "@payjarvis/database";
import { requireAuth } from "../middleware/auth.js";
import { createAuditLog } from "../services/audit.js";
import { createHash, randomBytes } from "node:crypto";

export async function botRoutes(app: FastifyInstance) {
  // Create bot
  app.post("/bots", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const { name, platform } = request.body as { name: string; platform: string };

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return reply.status(404).send({ success: false, error: "User not found" });

    const apiKey = `pj_bot_${randomBytes(32).toString("hex")}`;
    const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");

    const bot = await prisma.bot.create({
      data: {
        name,
        platform: platform as any,
        ownerId: user.id,
        apiKeyHash,
      },
    });

    await createAuditLog({
      entityType: "bot",
      entityId: bot.id,
      action: "CREATE",
      actorType: "user",
      actorId: user.id,
      ipAddress: request.ip,
    });

    return reply.status(201).send({
      success: true,
      data: { ...bot, apiKey }, // Return API key only on creation
    });
  });

  // List bots
  app.get("/bots", { preHandler: [requireAuth] }, async (request) => {
    const userId = (request as any).userId as string;
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return { success: false, error: "User not found" };

    const bots = await prisma.bot.findMany({
      where: { ownerId: user.id },
      include: { policy: true },
    });

    return { success: true, data: bots };
  });

  // Get single bot
  app.get("/bots/:botId", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const { botId } = request.params as { botId: string };
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return reply.status(404).send({ success: false, error: "User not found" });

    const bot = await prisma.bot.findFirst({
      where: { id: botId, ownerId: user.id },
      include: { policy: true },
    });

    if (!bot) return reply.status(404).send({ success: false, error: "Bot not found" });
    return { success: true, data: bot };
  });

  // Update bot
  app.patch("/bots/:botId", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const { botId } = request.params as { botId: string };
    const updates = request.body as Record<string, unknown>;
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return reply.status(404).send({ success: false, error: "User not found" });

    const existing = await prisma.bot.findFirst({ where: { id: botId, ownerId: user.id } });
    if (!existing) return reply.status(404).send({ success: false, error: "Bot not found" });

    const allowedFields = ["name", "platform", "status"];
    const filtered: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updates) filtered[key] = updates[key];
    }

    const bot = await prisma.bot.update({
      where: { id: botId },
      data: filtered,
    });

    await createAuditLog({
      entityType: "bot",
      entityId: bot.id,
      action: "UPDATE",
      actorType: "user",
      actorId: user.id,
      payload: filtered,
      ipAddress: request.ip,
    });

    return { success: true, data: bot };
  });

  // Delete bot
  app.delete("/bots/:botId", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const { botId } = request.params as { botId: string };
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return reply.status(404).send({ success: false, error: "User not found" });

    const existing = await prisma.bot.findFirst({ where: { id: botId, ownerId: user.id } });
    if (!existing) return reply.status(404).send({ success: false, error: "Bot not found" });

    await prisma.bot.delete({ where: { id: botId } });

    await createAuditLog({
      entityType: "bot",
      entityId: botId,
      action: "DELETE",
      actorType: "user",
      actorId: user.id,
      ipAddress: request.ip,
    });

    return { success: true, message: "Bot deleted" };
  });
}
