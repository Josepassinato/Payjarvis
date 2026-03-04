import { prisma } from "@payjarvis/database";

const TELEGRAM_API = "https://api.telegram.org";

export async function sendTelegramNotification(chatId: string, message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("[Notification] TELEGRAM_BOT_TOKEN not configured");
    return false;
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Notification] Telegram API error:", err);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Notification] Failed to send Telegram message:", err);
    return false;
  }
}

export async function notifyApprovalCreated(
  ownerId: string,
  data: { botName: string; amount: number; merchantName: string; approvalId: string }
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: ownerId } });
  if (!user) return;

  if (user.notificationChannel !== "telegram" || !user.telegramChatId) return;

  const message =
    `<b>PayJarvis — Aprovacao Necessaria</b>\n\n` +
    `Bot: <b>${data.botName}</b>\n` +
    `Merchant: ${data.merchantName}\n` +
    `Valor: <b>$${data.amount.toFixed(2)}</b>\n\n` +
    `Acesse o dashboard para aprovar ou rejeitar.\n` +
    `ID: <code>${data.approvalId}</code>`;

  const sent = await sendTelegramNotification(user.telegramChatId, message);

  if (sent) {
    await prisma.approvalRequest.update({
      where: { id: data.approvalId },
      data: { pushSent: true },
    }).catch(() => {}); // non-critical
  }
}
