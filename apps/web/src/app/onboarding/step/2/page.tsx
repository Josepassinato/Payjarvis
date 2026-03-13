"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useTranslation } from "react-i18next";
import { submitOnboardingStep, getOnboardingStatus } from "@/lib/api";
import { OnboardingProgress } from "@/components/onboarding-progress";

const PLATFORMS = [
  { value: "CUSTOM_API", label: "Custom API" },
  { value: "TELEGRAM", label: "Telegram" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "DISCORD", label: "Discord" },
  { value: "SLACK", label: "Slack" },
];

export default function OnboardingStep2() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("CUSTOM_API");
  const [description, setDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ botId: string; apiKey: string; agentId: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const status = await getOnboardingStatus(token);
        if (status.onboardingStep >= 5) {
          router.replace("/dashboard");
        } else if (status.onboardingStep < 1) {
          router.replace("/onboarding/step/1");
        }
      } catch {
        router.replace("/onboarding/step/1");
      }
    })();
  }, [getToken, router]);

  const handleSubmit = async () => {
    console.log("[PJ:STEP2] Submit clicked", { name: name.trim(), platform, description: description.trim() });
    if (!name.trim() || !platform) return;
    setSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      console.log("[PJ:STEP2] Submitting bot creation...");
      const res = await submitOnboardingStep(2, {
        name: name.trim(),
        platform,
        description: description.trim(),
      }, token) as any;

      console.log("[PJ:STEP2] Bot created:", { botId: res.bot?.id, agentId: res.agentId, hasApiKey: !!res.apiKey });
      setResult({
        botId: res.bot?.id ?? "",
        apiKey: res.apiKey ?? "",
        agentId: res.agentId ?? "",
      });
    } catch (err) {
      console.error("[PJ:STEP2] Bot creation failed:", err);
      setError(err instanceof Error ? err.message : t("onboarding.step2.submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleContinue = () => {
    router.push("/onboarding/step/3");
  };

  return (
    <div>
      <OnboardingProgress current={2} />

      <div className="bg-surface-card border border-surface-border rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">{t("onboarding.step2.title")}</h2>
          <p className="text-sm text-gray-400 mt-1">{t("onboarding.step2.subtitle")}</p>
        </div>

        {!result ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t("onboarding.step2.botName")} *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("onboarding.step2.botNamePlaceholder")}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">{t("onboarding.step2.platform")} *</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">{t("onboarding.step2.description")}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("onboarding.step2.descriptionPlaceholder")}
                rows={2}
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 resize-none"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-blocked/10 border border-blocked/20 px-4 py-2 text-sm text-blocked">
                {error}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button
                onClick={() => router.push("/onboarding/step/1")}
                className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                {t("common.back")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!name.trim() || submitting}
                className="px-8 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50"
              >
                {submitting ? t("common.loading") : t("onboarding.step2.createBot")}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-approved/10 border border-approved/20 px-4 py-3">
              <p className="text-sm text-approved font-medium">{t("onboarding.step2.botCreated")}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-blocked mb-2">
                {t("onboarding.step2.apiKeyWarning")}
              </label>
              <div className="flex items-center gap-2 bg-surface rounded-lg p-3 border border-surface-border">
                <code className="flex-1 text-xs text-white font-mono break-all select-all">
                  {result.apiKey}
                </code>
                <button
                  onClick={() => handleCopy(result.apiKey)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors shrink-0 ${
                    copied ? "bg-approved/20 text-approved" : "bg-surface-hover text-gray-400 hover:text-white"
                  }`}
                >
                  {copied ? t("common.copied") : t("common.copy")}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-2">{t("onboarding.step2.quickStart")}</label>
              <pre className="bg-surface rounded-lg p-3 border border-surface-border text-xs text-gray-300 overflow-x-auto">
                <code>{`npm install @payjarvis/agent-sdk

import { PayJarvis } from "@payjarvis/agent-sdk";

const pj = new PayJarvis({
  apiKey: "${result.apiKey}",
  botId: "${result.botId}",
});`}</code>
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleContinue}
                className="px-8 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors"
              >
                {t("common.next")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
