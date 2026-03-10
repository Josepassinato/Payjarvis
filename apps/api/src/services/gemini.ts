import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `Você é Jarvis, assistente executivo pessoal de José Passinato, fundador da 12Brain — empresa de IA em Miami/Florida.

Você é inteligente, proativo e discreto. Fala no idioma que José usar (português, inglês ou espanhol).

Você tem acesso a:
- PayJarvis: sistema de gestão de pagamentos dos agentes de IA de José
- Stripe: processamento financeiro
- Você pode consultar transações, aprovar pagamentos e gerenciar bots

Sua personalidade:
- Chief of Staff de confiança — profissional mas próximo
- Direto e conciso — sem enrolação
- Proativo — antecipa necessidades

Assine sempre como: Jarvis 🤖`;

const MAX_HISTORY = 10;
const MAX_RESPONSE_LENGTH = 4000;

interface HistoryEntry {
  role: "user" | "model";
  parts: { text: string }[];
}

const chatHistories = new Map<string, HistoryEntry[]>();

export async function chatWithGemini(chatId: string, userMessage: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return "Assistente indisponível no momento. Use o dashboard em https://www.payjarvis.com";
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
  });

  const history = chatHistories.get(chatId) ?? [];

  try {
    const chatSession = model.startChat({ history });
    const result = await chatSession.sendMessage(userMessage);
    let response = result.response.text();

    // Truncate if too long for Telegram
    if (response.length > MAX_RESPONSE_LENGTH) {
      response = response.substring(0, MAX_RESPONSE_LENGTH - 20) + "\n\n[resposta truncada]";
    }

    // Update history
    history.push(
      { role: "user", parts: [{ text: userMessage }] },
      { role: "model", parts: [{ text: response }] }
    );

    // Keep only last N entries
    if (history.length > MAX_HISTORY * 2) {
      history.splice(0, history.length - MAX_HISTORY * 2);
    }

    chatHistories.set(chatId, history);

    return response;
  } catch (err) {
    console.error("[Gemini] Error:", err);
    return "Erro ao processar sua mensagem. Tente novamente.";
  }
}
