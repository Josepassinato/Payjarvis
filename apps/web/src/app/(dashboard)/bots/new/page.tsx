"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/nextjs";
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
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Step 1
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("CUSTOM_API");

  // Step 2
  const [maxPerPurchase, setMaxPerPurchase] = useState(50);
  const [dailyLimit, setDailyLimit] = useState(200);
  const [autoApprove, setAutoApprove] = useState(25);

  // Step 3
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linkInstructions, setLinkInstructions] = useState<string | null>(null);
  const [linkingTelegram, setLinkingTelegram] = useState(false);

  // Step 4
  const [createdBot, setCreatedBot] = useState<CreateBotResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleNext = () => setStep((s) => Math.min(s + 1, 4) as Step);
  const handleBack = () => setStep((s) => Math.max(s - 1, 1) as Step);

  const handleLinkTelegram = async () => {
    setLinkingTelegram(true);
    try {
      const token = await getToken();
      const result = await linkTelegram(token);
      setLinkCode(result.code);
      setLinkInstructions(result.instructions);
      setTelegramEnabled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("newBot.failedTelegram"));
    } finally {
      setLinkingTelegram(false);
    }
  };

  const handleCreateBot = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const token = await getToken();
      const result = await createBot(name.trim(), platform, token);

      try {
        await upsertPolicy(result.id, {
          maxPerTransaction: maxPerPurchase,
          maxPerDay: dailyLimit,
          maxPerWeek: dailyLimit * 5,
          maxPerMonth: dailyLimit * 25,
          autoApproveLimit: autoApprove,
          requireApprovalUp: maxPerPurchase,
        }, token);
      } catch {
        // Bot created with default policy
      }

      setCreatedBot(result);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("newBot.failedCreate"));
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [t("newBot.step1"), t("newBot.step2"), t("newBot.step3"), t("newBot.step4")];

  return (
    <div className="max-w-xl mx-auto mt-12">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                i + 1 === step
                  ? "bg-brand-600 text-white"
                  : i + 1 < step
                  ? "bg-approved/20 text-approved"
                  : "bg-surface-hover text-gray-500"
              }`}
            >
              {i + 1 < step ? "\u2713" : i + 1}
            </div>
            <span className={`text-xs ${i + 1 === step ? "text-white" : "text-gray-500"}`}>
              {label}
            </span>
            {i < steps.length - 1 && <div className="w-4 h-px bg-surface-border" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-blocked/10 border border-blocked/20 px-4 py-2 text-sm text-blocked">
          {error}
        </div>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">{t("newBot.nameTitle")}</h2>
          <p className="text-sm text-gray-500">{t("newBot.nameDesc")}</p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t("newBot.botName")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("newBot.botNamePlaceholder")}
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t("newBot.platform")}</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
            >
              {platforms.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={handleNext}
              disabled={!name.trim()}
              className="px-6 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50"
            >
              {t("common.next")}
            </button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-6 space-y-5">
          <h2 className="text-xl font-bold text-white">{t("newBot.limitsTitle")}</h2>
          <p className="text-sm text-gray-500">{t("newBot.limitsDesc")}</p>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-gray-500">{t("newBot.maxPerPurchase")}</label>
              <span className="text-xs text-white font-medium">${maxPerPurchase}</span>
            </div>
            <input
              type="range"
              min={1}
              max={500}
              value={maxPerPurchase}
              onChange={(e) => setMaxPerPurchase(Number(e.target.value))}
              className="w-full accent-brand-600"
            />
            <div className="flex justify-between text-xs text-gray-600">
              <span>$1</span>
              <span>$500</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-gray-500">{t("newBot.dailyLimit")}</label>
              <span className="text-xs text-white font-medium">${dailyLimit}</span>
            </div>
            <input
              type="range"
              min={10}
              max={2000}
              step={10}
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Number(e.target.value))}
              className="w-full accent-brand-600"
            />
            <div className="flex justify-between text-xs text-gray-600">
              <span>$10</span>
              <span>$2,000</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-gray-500">{t("newBot.autoApproveUpTo")}</label>
              <span className="text-xs text-white font-medium">${autoApprove}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={autoApprove}
              onChange={(e) => setAutoApprove(Number(e.target.value))}
              className="w-full accent-brand-600"
            />
            <div className="flex justify-between text-xs text-gray-600">
              <span>$0</span>
              <span>$100</span>
            </div>
          </div>

          {autoApprove > maxPerPurchase && (
            <div className="rounded-lg bg-pending/10 border border-pending/20 px-3 py-2 text-xs text-pending">
              {t("newBot.autoApproveWarning", { auto: autoApprove, max: maxPerPurchase })}
            </div>
          )}

          <div className="rounded-lg bg-surface p-3 text-xs text-gray-400 space-y-1">
            <p>{t("newBot.weekly")}: <span className="text-white">${(dailyLimit * 5).toLocaleString()}</span></p>
            <p>{t("newBot.monthly")}: <span className="text-white">${(dailyLimit * 25).toLocaleString()}</span></p>
            <p>{t("newBot.humanApproval")}: <span className="text-white">${autoApprove} — ${maxPerPurchase}</span></p>
            <p>{t("newBot.blocked")}: <span className="text-white">{t("common.above")} ${maxPerPurchase}</span></p>
          </div>

          <div className="flex justify-between pt-2">
            <button onClick={handleBack} className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors">
              {t("common.back")}
            </button>
            <button
              onClick={handleNext}
              disabled={autoApprove > maxPerPurchase}
              className="px-6 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50"
            >
              {t("common.next")}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-6 space-y-5">
          <h2 className="text-xl font-bold text-white">{t("newBot.notifTitle")}</h2>
          <p className="text-sm text-gray-500">
            {t("newBot.notifDesc")}
          </p>

          {!linkCode ? (
            <div className="space-y-3">
              <button
                onClick={handleLinkTelegram}
                disabled={linkingTelegram}
                className="w-full py-3 bg-[#0088cc] text-white text-sm font-medium rounded-lg hover:bg-[#0077b5] transition-colors disabled:opacity-50"
              >
                {linkingTelegram ? t("newBot.generatingCode") : t("newBot.connectTelegram")}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg bg-[#0088cc]/10 border border-[#0088cc]/20 p-4 text-center">
                <p className="text-xs text-gray-400 mb-2">{t("newBot.linkCode")}</p>
                <p className="text-3xl font-mono font-bold text-white tracking-widest">{linkCode}</p>
              </div>
              <p className="text-xs text-gray-400">{linkInstructions}</p>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button onClick={handleBack} className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors">
              {t("common.back")}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => handleCreateBot()}
                className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                {t("common.skip")}
              </button>
              <button
                onClick={handleCreateBot}
                disabled={creating}
                className="px-6 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50"
              >
                {creating ? t("newBot.creating") : t("newBot.createBot")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4 */}
      {step === 4 && createdBot && (
        <div className="bg-surface-card border border-approved/30 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-approved">{t("newBot.doneTitle")}</h2>
          <p className="text-sm text-gray-400">
            <span className="text-white font-medium">{createdBot.name}</span> {t("newBot.doneDesc", { name: "" }).trim()}
          </p>

          <div>
            <label className="block text-xs font-semibold text-blocked mb-2">
              {t("newBot.apiKeyWarning")}
            </label>
            <div className="flex items-center gap-2 bg-surface rounded-lg p-3 border border-surface-border">
              <code className="flex-1 text-xs text-white font-mono break-all select-all">
                {createdBot.apiKey}
              </code>
              <button
                onClick={() => handleCopy(createdBot.apiKey)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors shrink-0 ${
                  copied ? "bg-approved/20 text-approved" : "bg-surface-hover text-gray-400 hover:text-white"
                }`}
              >
                {copied ? t("common.copied") : t("common.copy")}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-2">{t("newBot.installLabel")}</label>
            <pre className="bg-surface rounded-lg p-3 border border-surface-border text-xs text-gray-300 overflow-x-auto">
              <code>{`import { PayJarvis } from "@payjarvis/agent-sdk";

const pj = new PayJarvis({
  apiKey: "${createdBot.apiKey}",
  botId: "${createdBot.id}",
});

const decision = await pj.requestPayment({
  merchantName: "Amazon",
  amount: 29.99,
  currency: "USD",
  category: "shopping",
});

if (decision.approved) {
  // BDIT token em decision.bditToken
  // Apresente ao merchant no checkout
}`}</code>
            </pre>
          </div>

          <button
            onClick={() => router.push(`/bots/${createdBot.id}`)}
            className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors"
          >
            {t("newBot.goToDashboard")}
          </button>
        </div>
      )}
    </div>
  );
}
