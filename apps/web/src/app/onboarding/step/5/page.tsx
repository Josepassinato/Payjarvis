"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useTranslation } from "react-i18next";
import { submitOnboardingStep, getOnboardingStatus } from "@/lib/api";
import { OnboardingProgress } from "@/components/onboarding-progress";

export default function OnboardingStep5() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const router = useRouter();

  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const status = await getOnboardingStatus(token);
        if (status.onboardingStep >= 6) {
          router.replace("/dashboard");
        } else if (status.onboardingStep < 4) {
          router.replace(`/onboarding/step/${status.onboardingStep + 1}`);
        }
      } catch {
        router.replace("/onboarding/step/1");
      }
    })();
  }, [getToken, router]);

  const handleSubmit = async () => {
    console.log("[PJ:STEP5] Accept terms clicked, accepted:", accepted);
    if (!accepted) return;
    setSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      console.log("[PJ:STEP5] Submitting step 5 (accept terms)...");
      await submitOnboardingStep(5, {}, token);
      console.log("[PJ:STEP5] Onboarding completed! Redirecting to dashboard in 2s");
      setCompleted(true);
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err) {
      console.error("[PJ:STEP5] Submit failed:", err);
      setError(err instanceof Error ? err.message : t("onboarding.step5.submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  if (completed) {
    return (
      <div>
        <OnboardingProgress current={6} />
        <div className="bg-surface-card border border-approved/30 rounded-xl p-8 text-center space-y-4">
          <div className="text-5xl">&#127881;</div>
          <h2 className="text-2xl font-bold text-white">{t("onboarding.step5.successTitle")}</h2>
          <p className="text-gray-400">{t("onboarding.step5.successDesc")}</p>
          <div className="h-2 w-32 mx-auto bg-surface-border rounded-full overflow-hidden">
            <div className="h-full bg-brand-600 animate-pulse rounded-full" style={{ width: "100%" }} />
          </div>
          <p className="text-xs text-gray-500">{t("onboarding.step5.redirecting")}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <OnboardingProgress current={5} />

      <div className="bg-surface-card border border-surface-border rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">{t("onboarding.step5.title")}</h2>
          <p className="text-sm text-gray-400 mt-1">{t("onboarding.step5.subtitle")}</p>
        </div>

        {/* Terms summary */}
        <div className="bg-surface rounded-xl border border-surface-border p-4 space-y-4 max-h-64 overflow-y-auto text-sm text-gray-300">
          <h3 className="text-white font-semibold">{t("onboarding.step5.termsTitle")}</h3>
          <ul className="space-y-2 list-disc pl-4">
            <li>{t("onboarding.step5.term1")}</li>
            <li>{t("onboarding.step5.term2")}</li>
            <li>{t("onboarding.step5.term3")}</li>
            <li>{t("onboarding.step5.term4")}</li>
            <li>{t("onboarding.step5.term5")}</li>
            <li>{t("onboarding.step5.term6")}</li>
          </ul>
        </div>

        {/* Checkbox */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-600 bg-surface text-brand-600 focus:ring-brand-500 accent-brand-600"
          />
          <span className="text-sm text-gray-300">
            {t("onboarding.step5.acceptTerms")}
          </span>
        </label>

        {error && (
          <div className="rounded-lg bg-blocked/10 border border-blocked/20 px-4 py-2 text-sm text-blocked">
            {error}
          </div>
        )}

        <div className="flex justify-between pt-2">
          <button
            onClick={() => router.push("/onboarding/step/4")}
            className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {t("common.back")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!accepted || submitting}
            className="px-8 py-2.5 bg-approved text-white text-sm font-medium rounded-lg hover:bg-approved/90 transition-colors disabled:opacity-50"
          >
            {submitting ? t("common.loading") : t("onboarding.step5.complete")}
          </button>
        </div>
      </div>
    </div>
  );
}
