import type { FastifyInstance } from "fastify";
import { prisma, Prisma } from "@payjarvis/database";
import { requireAuth } from "../middleware/auth.js";
import { getPaymentProvider, getAvailableProviders } from "../services/payments/payment-factory.js";
import { StripeProvider } from "../services/payments/providers/stripe.provider.js";
import { encrypt } from "../services/payments/vault.js";
import { createAuditLog } from "../services/audit.js";

export async function paymentMethodRoutes(app: FastifyInstance) {
  // GET /payment-methods — list all payment methods for the current user
  app.get("/payment-methods", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = (request as any).userId as string;

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return reply.status(404).send({ success: false, error: "User not found" });

    const methods = await prisma.paymentMethod.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const providers = getAvailableProviders();

    return { success: true, data: { methods, providers } };
  });

  // POST /payment-methods/stripe/connect — save user's Stripe secret key
  app.post("/payment-methods/stripe/connect", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const { stripeSecretKey } = (request.body as { stripeSecretKey?: string }) ?? {};

    if (!stripeSecretKey || typeof stripeSecretKey !== "string") {
      return reply.status(400).send({ success: false, error: "stripeSecretKey is required" });
    }

    if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(stripeSecretKey)) {
      return reply.status(400).send({ success: false, error: "Invalid Stripe secret key format. Must start with sk_test_ or sk_live_" });
    }

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return reply.status(404).send({ success: false, error: "User not found" });

    const provider = getPaymentProvider("stripe") as StripeProvider;

    // Validate the key against Stripe API
    const validation = await provider.validateSecretKey(stripeSecretKey);
    if (!validation.valid) {
      return reply.status(400).send({ success: false, error: "Invalid Stripe key — could not authenticate with Stripe API" });
    }

    // Encrypt and store
    const encryptedKey = encrypt(stripeSecretKey);
    const keyHint = stripeSecretKey.slice(0, 7) + "..." + stripeSecretKey.slice(-4);

    await prisma.paymentMethod.upsert({
      where: {
        userId_provider: { userId: user.id, provider: "STRIPE" },
      },
      create: {
        userId: user.id,
        provider: "STRIPE",
        status: "CONNECTED",
        accountId: validation.accountName ?? "Stripe Account",
        credentials: { encrypted: encryptedKey },
        metadata: { keyHint },
      },
      update: {
        status: "CONNECTED",
        accountId: validation.accountName ?? "Stripe Account",
        credentials: { encrypted: encryptedKey },
        metadata: { keyHint },
      },
    });

    await createAuditLog({
      entityType: "payment_method",
      entityId: user.id,
      action: "payment_method.connected",
      actorType: "user",
      actorId: user.id,
      payload: { provider: "stripe", keyHint },
      ipAddress: request.ip,
    });

    return { success: true, data: { connected: true, accountName: validation.accountName, keyHint } };
  });

  // GET /payment-methods/:provider/status — check connection status for a provider
  app.get("/payment-methods/:provider/status", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const { provider: providerName } = request.params as { provider: string };

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return reply.status(404).send({ success: false, error: "User not found" });

    const method = await prisma.paymentMethod.findFirst({
      where: { userId: user.id, provider: providerName.toUpperCase() as any },
    });

    if (!method) {
      return reply.status(404).send({ success: false, error: "Payment method not found" });
    }

    return {
      success: true,
      data: {
        provider: method.provider,
        status: method.status,
        accountId: method.accountId,
        createdAt: method.createdAt,
        updatedAt: method.updatedAt,
      },
    };
  });

  // DELETE /payment-methods/:provider — disconnect a payment method
  app.delete("/payment-methods/:provider", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const { provider: providerName } = request.params as { provider: string };

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return reply.status(404).send({ success: false, error: "User not found" });

    const method = await prisma.paymentMethod.findFirst({
      where: { userId: user.id, provider: providerName.toUpperCase() as any },
    });

    if (!method) {
      return reply.status(404).send({ success: false, error: "Payment method not found" });
    }

    // Update status to DISABLED and clear credentials
    await prisma.paymentMethod.update({
      where: { id: method.id },
      data: { status: "DISABLED", accountId: null, credentials: Prisma.JsonNull, metadata: Prisma.JsonNull },
    });

    // If stripe, also clear user.stripeAccountId
    if (providerName.toLowerCase() === "stripe") {
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeAccountId: null },
      });
    }

    await createAuditLog({
      entityType: "payment_method",
      entityId: user.id,
      action: "payment_method.disconnected",
      actorType: "user",
      actorId: user.id,
      payload: { provider: providerName.toLowerCase() },
      ipAddress: request.ip,
    });

    return { success: true, message: "Payment method disconnected" };
  });
}
