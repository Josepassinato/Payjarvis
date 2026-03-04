import type { FastifyRequest, FastifyReply } from "fastify";

const DEV_USER_ID = "dev-user-local";

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Dev-mode bypass when no Clerk key is configured
  if (process.env.NODE_ENV !== "production" && (!process.env.CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY === "sk_test_placeholder")) {
    (request as any).userId = DEV_USER_ID;
    return;
  }

  try {
    const { verifyToken } = await import("@clerk/fastify");

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ success: false, error: "Missing authorization token" });
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    if (!payload.sub) {
      return reply.status(401).send({ success: false, error: "Invalid token" });
    }

    (request as any).userId = payload.sub;
  } catch {
    return reply.status(401).send({ success: false, error: "Authentication failed" });
  }
}
