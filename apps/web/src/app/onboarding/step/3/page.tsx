"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useTranslation } from "react-i18next";
import {
  getOnboardingStatus,
  submitOnboardingStep,
  getAvailableIntegrations,
  type AvailableProvider,
} from "@/lib/api";
import { OnboardingProgress } from "@/components/onboarding-progress";
import { IntegrationGrid, type EnabledState } from "@/components/integration-grid";

export default function OnboardingStep3() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const router = useRouter();

  const [providers, setProviders] = useState<AvailableProvider[]>([]);
  const [enabled, setEnabled] = useState<EnabledState>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const [status, available] = await Promise.all([
          getOnboardingStatus(token),
          getAvailableIntegrations(token),
        ]);

        if (status.onboardingStep >= 6) {
          router.replace("/dashboard");
          return;
        } else if (status.onboardingStep < 2) {
          router.replace(`/onboarding/step/${status.onboardingStep + 1}`);
          return;
        }

        setProviders(available);
        // Pre-enable all available providers by default
        const defaultEnabled: EnabledState = {};
        for (const p of available) {
          if (p.available) defaultEnabled[p.provider] = true;
        }
        setEnabled(defaultEnabled);
      } catch {
        router.replace("/onboarding/step/1");
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken, router]);

  const handleToggle = (provider: string, _category: string, newValue: boolean) => {
    setEnabled((prev) => ({ ...prev, [provider]: newValue }));
  };

  const handleSubmit = async (skip: boolean) => {
    setSubmitting(true);
    setError(null);

    try {
      const token = await getToken();

      if (skip) {
        await submitOnboardingStep(3, { skipped: true }, token);
      } else {
        const integrations = Object.entries(enabled)
          .filter(([, v]) => v)
          .map(([provider]) => {
            const p = providers.find((x) => x.provider === provider);
            return { provider, category: p?.category || "other" };
          });
        await submitOnboardingStep(3, { integrations }, token);
      }

      router.push("/onboarding/step/4");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("integrations.submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  const enabledCount = Object.values(enabled).filter(Boolean).length;

  if (loading) {
    return (
      <div>
        <OnboardingProgress current={3} />
        <div className="bg-surface-card border border-surface-border rounded-xl p-8 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          <span className="ml-3 text-sm text-gray-400">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <OnboardingProgress current={3} />

      <div className="bg-surface-card border border-surface-border rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">{t("integrations.title")}</h2>
          <p className="text-sm text-gray-400 mt-1">{t("integrations.subtitle")}</p>
        </div>

        <div className="max-h-[50vh] overflow-y-auto pr-1">
          <IntegrationGrid
            providers={providers}
            enabled={enabled}
            onToggle={handleToggle}
          />
        </div>

        {enabledCount > 0 && (
          <div className="flex items-center gap-2 text-sm text-brand-400">
            <span className="h-5 w-5 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center">
              {enabledCount}
            </span>
            {t("integrations.selectedCount", { count: enabledCount })}
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-blocked/10 border border-blocked/20 px-4 py-2 text-sm text-blocked">
            {error}
          </div>
        )}

        <div className="flex justify-between pt-2">
          <button
            onClick={() => router.push("/onboarding/step/2")}
            className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {t("common.back")}
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => handleSubmit(true)}
              disabled={submitting}
              className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              {t("integrations.skip")}
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="px-8 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50"
            >
              {submitting ? t("common.loading") : t("integrations.saveAndContinue")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
