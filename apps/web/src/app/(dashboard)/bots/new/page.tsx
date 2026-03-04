"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBot, upsertPolicy, linkTelegram } from "@/lib/api";
import type { CreateBotResult } from "@/lib/api";

const platforms = [
  { value: "CUSTOM_API", label: "API" },
  { value: "TELEGRAM", label: "Telegram" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "DISCORD", label: "Discord" },
  { value: "SLACK", label: "Slack" },
];

type Step = 1 | 2 | 3 | 4;

export default function NewBotPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — Name & Platform
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("CUSTOM_API");

  // Step 2 — Spending Limits
  const [maxPerPurchase, setMaxPerPurchase] = useState(50);
  const [dailyLimit, setDailyLimit] = useState(200);
  const [autoApprove, setAutoApprove] = useState(25);

  // Step 3 — Telegram
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramCode, setTelegramCode] = useState<string | null>(null);
  const [telegramInstructions, setTelegramInstructions] = useState<string | null>(null);
  const [linkingTelegram, setLinkingTelegram] = useState(false);

  // Step 4 — Done
  const [createdBot, setCreatedBot] = useState<CreateBotResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleTelegramToggle = async (enabled: boolean) => {
    setTelegramEnabled(enabled);
    if (enabled && !telegramCode) {
      setLinkingTelegram(true);
      try {
        const result = await linkTelegram();
        setTelegramCode(result.code);
        setTelegramInstructions(result.instructions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao gerar codigo Telegram");
        setTelegramEnabled(false);
      } finally {
        setLinkingTelegram(false);
      }
    }
  };

  const handleCreateAndFinish = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const bot = await createBot(name.trim(), platform);

      // Update policy with wizard values
      await upsertPolicy(bot.id, {
        maxPerTransaction: maxPerPurchase,
        maxPerDay: dailyLimit,
        maxPerWeek: dailyLimit * 5,
        maxPerMonth: dailyLimit * 25,
        autoApproveLimit: autoApprove,
        requireApprovalUp: maxPerPurchase,
      });

      setCreatedBot(bot);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar bot");
    } finally {
      setCreating(false);
    }
  };

  const handleCopyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cardClass = "bg-surface-card border border-surface-border rounded-xl p-6";
  const inputClass = "w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500";
  const btnPrimary = "py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50";
  const btnGhost = "px-4 py-2.5 bg-surface-hover text-gray-400 text-sm rounded-lg hover:text-white transition-colors";

  // Step indicators
  const stepLabels = ["Nome", "Limites", "Notificacoes", "Pronto"];

  return (
    <div className="max-w-xl mx-auto mt-12">
      {/* Step indicator */}
      <div className="flex items-center justify-between mb-8">
        {stepLabels.map((label, i) => {
          const stepNum = (i + 1) as Step;
          const isActive = step === stepNum;
          const isDone = step > stepNum;
          return (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                isDone ? "bg-approved/20 text-approved" : isActive ? "bg-brand-600 text-white" : "bg-surface-hover text-gray-500"
              }`}>
                {isDone ? "\u2713" : stepNum}
              </div>
              <span className={`text-xs ${isActive ? "text-white" : "text-gray-500"}`}>{label}</span>
              {i < 3 && <div className={`flex-1 h-px mx-2 ${isDone ? "bg-approved/30" : "bg-surface-border"}`} />}
            </div>
          );
        })}
      </div>

      {error && <p className="text-sm text-blocked mb-4">{error}</p>}

      {/* Step 1: Name & Platform */}
      {step === 1 && (
        <div className={cardClass}>
          <h2 className="text-xl font-bold text-white mb-1">Nome e plataforma</h2>
          <p className="text-sm text-gray-500 mb-6">Identifique seu agente de IA.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nome do Bot</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Assistente de Compras"
                className={inputClass}
                onKeyDown={(e) => e.key === "Enter" && name.trim() && setStep(2)}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Plataforma</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputClass}>
                {platforms.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(2)} disabled={!name.trim()} className={`flex-1 ${btnPrimary}`}>
                Proximo
              </button>
              <button onClick={() => router.push("/bots")} className={btnGhost}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Spending Limits */}
      {step === 2 && (
        <div className={cardClass}>
          <h2 className="text-xl font-bold text-white mb-1">Limites de gasto</h2>
          <p className="text-sm text-gray-500 mb-6">Defina quanto seu bot pode gastar.</p>

          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-500">Max por compra</label>
                <span className="text-sm text-white font-mono">${maxPerPurchase}</span>
              </div>
              <input
                type="range" min={1} max={500} value={maxPerPurchase}
                onChange={(e) => setMaxPerPurchase(Number(e.target.value))}
                className="w-full accent-brand-600"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>$1</span><span>$500</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-500">Limite diario</label>
                <span className="text-sm text-white font-mono">${dailyLimit}</span>
              </div>
              <input
                type="range" min={10} max={2000} step={10} value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="w-full accent-brand-600"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>$10</span><span>$2,000</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-500">Auto-aprovar ate</label>
                <span className="text-sm text-white font-mono">${autoApprove}</span>
              </div>
              <input
                type="range" min={0} max={100} value={autoApprove}
                onChange={(e) => setAutoApprove(Number(e.target.value))}
                className="w-full accent-brand-600"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>$0</span><span>$100</span>
              </div>
            </div>

            <div className="bg-surface rounded-lg p-3 border border-surface-border">
              <p className="text-xs text-gray-500">
                Derivados: Semanal = <span className="text-white">${dailyLimit * 5}</span> &middot; Mensal = <span className="text-white">${dailyLimit * 25}</span>
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(1)} className={btnGhost}>Voltar</button>
              <button onClick={() => setStep(3)} className={`flex-1 ${btnPrimary}`}>Proximo</button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Notifications */}
      {step === 3 && (
        <div className={cardClass}>
          <h2 className="text-xl font-bold text-white mb-1">Notificacoes</h2>
          <p className="text-sm text-gray-500 mb-6">Receba alertas quando seu bot quiser comprar algo acima do limite.</p>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-surface rounded-lg border border-surface-border">
              <div className="flex items-center gap-3">
                <span className="text-xl">&#x1f4e8;</span>
                <div>
                  <p className="text-sm text-white font-medium">Telegram</p>
                  <p className="text-xs text-gray-500">Receba alertas no Telegram</p>
                </div>
              </div>
              <button
                onClick={() => handleTelegramToggle(!telegramEnabled)}
                disabled={linkingTelegram}
                className={`w-12 h-6 rounded-full transition-colors relative ${telegramEnabled ? "bg-brand-600" : "bg-surface-hover"}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${telegramEnabled ? "translate-x-6" : "translate-x-0.5"}`} />
              </button>
            </div>

            {telegramEnabled && telegramCode && (
              <div className="bg-surface rounded-lg p-4 border border-brand-600/30">
                <p className="text-xs text-gray-400 mb-2">Envie este comando para <span className="text-white">@PayJarvisBot</span> no Telegram:</p>
                <div className="flex items-center gap-2 bg-surface-card rounded-lg p-3">
                  <code className="flex-1 text-sm text-white font-mono">/link {telegramCode}</code>
                  <button
                    onClick={() => handleCopyKey(`/link ${telegramCode}`)}
                    className="px-3 py-1 text-xs bg-surface-hover text-gray-400 rounded-lg hover:text-white"
                  >
                    {copied ? "Copiado!" : "Copiar"}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Codigo expira em 10 minutos.</p>
              </div>
            )}

            {linkingTelegram && (
              <p className="text-xs text-gray-400">Gerando codigo...</p>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(2)} className={btnGhost}>Voltar</button>
              <button
                onClick={handleCreateAndFinish}
                disabled={creating}
                className={`flex-1 ${btnPrimary}`}
              >
                {creating ? "Criando bot..." : "Criar bot"}
              </button>
              {!telegramEnabled && (
                <button onClick={handleCreateAndFinish} disabled={creating} className={`${btnGhost} text-xs`}>
                  Pular
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 4 && createdBot && (
        <div className={cardClass}>
          <div className="text-center mb-4">
            <div className="w-12 h-12 rounded-full bg-approved/20 text-approved mx-auto flex items-center justify-center text-2xl mb-3">
              &#x2713;
            </div>
            <h2 className="text-xl font-bold text-approved">Pronto!</h2>
            <p className="text-sm text-gray-400 mt-1">
              <span className="text-white font-medium">{createdBot.name}</span> criado com sucesso.
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-blocked mb-2">
              Sua API Key — Esta chave nao sera exibida novamente.
            </label>
            <div className="flex items-center gap-2 bg-surface rounded-lg p-3 border border-surface-border">
              <code className="flex-1 text-xs text-white font-mono break-all select-all">
                {createdBot.apiKey}
              </code>
              <button
                onClick={() => handleCopyKey(createdBot.apiKey)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors shrink-0 ${
                  copied ? "bg-approved/20 text-approved" : "bg-surface-hover text-gray-400 hover:text-white"
                }`}
              >
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-2">Instale o agent-sdk:</label>
            <div className="bg-surface rounded-lg p-3 border border-surface-border font-mono text-xs text-gray-300 overflow-x-auto">
              <pre className="whitespace-pre-wrap">{`npm install @payjarvis/agent-sdk

import { PayJarvis } from '@payjarvis/agent-sdk';

const pj = new PayJarvis({
  apiKey: '${createdBot.apiKey.substring(0, 12)}...',
  botId:  '${createdBot.id}',
});

const decision = await pj.requestApproval({
  merchant: 'Amazon',
  amount: 49.99,
  category: 'shopping',
});`}</pre>
            </div>
          </div>

          <button
            onClick={() => router.push(`/bots/${createdBot.id}`)}
            className={`w-full ${btnPrimary}`}
          >
            Ir para dashboard do bot
          </button>
        </div>
      )}
    </div>
  );
}
