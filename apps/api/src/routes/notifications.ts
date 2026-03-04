import type { FastifyInstance } from "fastify";
import { prisma } from "@payjarvis/database";
import { requireAuth } from "../middleware/auth.js";
import { sendTelegramNotification } from "../services/notifications.js";

export async function notificationRoutes(app: FastifyInstance) {
  // POST /notifications/telegram/link — generate linking code
  app.post("/notifications/telegram/link", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = (request as any).userId as string;

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return reply.status(404).send({ success: false, error: "User not found" });

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60_000); // 10 min TTL

    // Upsert — one code per user
    await prisma.telegramLinkCode.upsert({
      where: { userId: user.id },
      update: { code, expiresAt },
      create: { userId: user.id, code, expiresAt },
    });

    return {
      success: true,
      data: {
        code,
        instructions: `Abra o Telegram, encontre o bot @PayJarvisBot e envie: /link ${code}`,
      },
    };
  });

  // POST /notifications/telegram/webhook — Telegram calls this
  app.post("/notifications/telegram/webhook", async (request, reply) => {
    const body = request.body as any;
    const message = body?.message;

    if (!message?.text || !message?.chat?.id) {
      return reply.status(200).send({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text = (message.text as string).trim();

    // Handle /start command
    if (text === "/start") {
      await sendTelegramNotification(chatId,
        "PayJarvis Bot ativo.\n\nPara vincular sua conta, use:\n<code>/link SEU_CODIGO</code>\n\nGere o codigo no dashboard em Configuracoes > Notificacoes."
      );
      return reply.status(200).send({ ok: true });
    }

    // Handle /link CODE
    const linkMatch = text.match(/^\/link\s+(\d{6})$/);
    if (!linkMatch) {
      await sendTelegramNotification(chatId,
        "Comando nao reconhecido. Use <code>/link CODIGO</code> para vincular sua conta."
      );
      return reply.status(200).send({ ok: true });
    }

    const code = linkMatch[1];

    const linkCode = await prisma.telegramLinkCode.findUnique({ where: { code } });

    if (!linkCode || linkCode.expiresAt < new Date()) {
      await sendTelegramNotification(chatId,
        "Codigo invalido ou expirado. Gere um novo codigo no dashboard."
      );
      return reply.status(200).send({ ok: true });
    }

    // Link the user
    await prisma.user.update({
      where: { id: linkCode.userId },
      data: {
        telegramChatId: chatId,
        notificationChannel: "telegram",
      },
    });

    // Delete the used code
    await prisma.telegramLinkCode.delete({ where: { id: linkCode.id } });

    await sendTelegramNotification(chatId,
      "Conta vinculada com sucesso! Voce recebera notificacoes de aprovacao aqui."
    );

    return reply.status(200).send({ ok: true });
  });
}
