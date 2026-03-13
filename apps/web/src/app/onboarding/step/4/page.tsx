"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useTranslation } from "react-i18next";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { submitOnboardingStep, getOnboardingStatus } from "@/lib/api";
import { OnboardingProgress } from "@/components/onboarding-progress";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null;

const stripeAppearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#2563eb",
    colorBackground: "#1e2330",
    colorText: "#e5e7eb",
    colorDanger: "#ef4444",
    fontFamily: '"DM Sans", system-ui, sans-serif',
    borderRadius: "8px",
  },
};

/** Inline Stripe card form for onboarding — creates a fresh SetupIntent on mount */
function OnboardingCardForm({ onSuccess, onError }: { onSuccess: () => void; onError: (msg: string) => void }) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const { getToken } = useAuth();
  const [saving, setSaving] = useState(false);
  const [setupIntent, setSetupIntent] = useState<{ clientSecret: string; setupIntentId: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Create a fresh SetupIntent every time this component mounts
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await getToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        console.log("[PJ:STEP4] Creating fresh SetupIntent on mount...");
        const res = await fetch(`${API_URL}/payment-methods/setup-intent`, {
          method: "POST",
          headers,
          body: JSON.stringify({}),
        });
        const json = await res.json();

        if (cancelled) return;

        if (!res.ok || !json.success) {
          console.error("[PJ:STEP4] SetupIntent creation failed:", json);
          onError(json.error ?? t("onboarding.step4.cardSaveFailed"));
          return;
        }

        const { clientSecret, setupIntentId } = json.data;
        console.log("[PJ:STEP4] Fresh SetupIntent created:", { setupIntentId, hasClientSecret: !!clientSecret });
        setSetupIntent({ clientSecret, setupIntentId });
      } catch (err) {
        if (!cancelled) {
          console.error("[PJ:STEP4] Failed to create SetupIntent:", err);
          onError(t("onboarding.step4.cardSaveFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [getToken, onError, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !setupIntent) return;
    setSaving(true);
    console.log("[PJ:STEP4] Card form submitted — confirming SetupIntent:", setupIntent.setupIntentId);

    try {
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // 1. Confirm with Stripe using the fresh SetupIntent
      const cardEl = elements.getElement(CardElement);
      if (!cardEl) { console.error("[PJ:STEP4] CardElement not found in DOM"); onError("Card element not found"); return; }

      console.log("[PJ:STEP4] Confirming card with Stripe...");
      const { error: stripeError } = await stripe.confirmCardSetup(setupIntent.clientSecret, {
        payment_method: { card: cardEl },
      });

      if (stripeError) {
        console.error("[PJ:STEP4] Stripe confirmCardSetup error:", stripeError.type, stripeError.message);
        onError(stripeError.message ?? t("onboarding.step4.cardSaveFailed"));
        return;
      }
      console.log("[PJ:STEP4] Stripe confirmed OK");

      // 2. Confirm with backend
      console.log("[PJ:STEP4] Saving card to backend...");
      const confirmRes = await fetch(`${API_URL}/payment-methods/setup-intent/confirm`, {
        method: "POST",
        headers,
        body: JSON.stringify({ setupIntentId: setupIntent.setupIntentId }),
      });
      const confirmJson = await confirmRes.json();
      if (!confirmRes.ok || !confirmJson.success) {
        console.error("[PJ:STEP4] Backend confirm failed:", confirmJson);
        onError(confirmJson.error ?? t("onboarding.step4.cardSaveFailed"));
        return;
      }

      console.log("[PJ:STEP4] Card saved successfully:", confirmJson.data);
      onSuccess();
    } catch (err) {
      console.error("[PJ:STEP4] Unexpected error:", err);
      onError(t("onboarding.step4.cardSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        <span className="ml-2 text-sm text-gray-400">{t("common.loading")}</span>
      </div>
    );
  }

  if (!setupIntent) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="bg-surface-hover border border-surface-border rounded-lg p-3">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "14px",
                color: "#e5e7eb",
                "::placeholder": { color: "#6b7280" },
              },
              invalid: { color: "#ef4444" },
            },
          }}
        />
      </div>
      <p className="text-xs text-gray-500">
        {t("onboarding.step4.stripeNote")}
      </p>
      <button
        type="submit"
        disabled={saving || !stripe}
        className="w-full px-4 py-2.5 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-500 transition-colors disabled:opacity-50"
      >
        {saving ? t("common.loading") : t("onboarding.step4.saveCard")}
      </button>
    </form>
  );
}

export default function OnboardingStep4() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const router = useRouter();

  const [method, setMethod] = useState<"sdk" | "stripe_card">("sdk");
  const [cardSaved, setCardSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Key to force remount of Elements + OnboardingCardForm, creating a fresh SetupIntent
  const [stripeFormKey, setStripeFormKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const status = await getOnboardingStatus(token);
        if (status.onboardingStep >= 6) {
          router.replace("/dashboard");
        } else if (status.onboardingStep < 3) {
          router.replace(`/onboarding/step/${status.onboardingStep + 1}`);
        }
      } catch {
        router.replace("/onboarding/step/1");
      }
    })();
  }, [getToken, router]);

  const handleSelectStripeCard = useCallback(() => {
    setMethod("stripe_card");
    setError(null);
    // Increment key to force a fresh SetupIntent if re-selecting
    setStripeFormKey((k) => k + 1);
  }, []);

  const handleSubmit = async () => {
    console.log("[PJ:STEP4] Submitting step 4 with method:", method);
    setSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      await submitOnboardingStep(4, { method }, token);
      console.log("[PJ:STEP4] Step 4 completed — navigating to step 5");
      router.push("/onboarding/step/5");
    } catch (err) {
      console.error("[PJ:STEP4] Step 4 submit failed:", err);
      setError(err instanceof Error ? err.message : t("onboarding.step4.submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <OnboardingProgress current={4} />

      <div className="bg-surface-card border border-surface-border rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">{t("onboarding.step4.title")}</h2>
          <p className="text-sm text-gray-400 mt-1">{t("onboarding.step4.subtitle")}</p>
        </div>

        <div className="space-y-3">
          {/* SDK option */}
          <button
            onClick={() => { setMethod("sdk"); setCardSaved(false); setError(null); }}
            className={`w-full text-left rounded-xl border p-4 transition-colors ${
              method === "sdk"
                ? "border-brand-600 bg-brand-600/10"
                : "border-surface-border bg-surface hover:border-gray-600"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                method === "sdk" ? "border-brand-600" : "border-gray-600"
              }`}>
                {method === "sdk" && <div className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{t("onboarding.step4.sdkTitle")}</p>
                <p className="text-xs text-gray-400 mt-1">{t("onboarding.step4.sdkDesc")}</p>
              </div>
            </div>
          </button>

          {/* Stripe card option */}
          <button
            onClick={handleSelectStripeCard}
            className={`w-full text-left rounded-xl border p-4 transition-colors ${
              method === "stripe_card"
                ? "border-brand-600 bg-brand-600/10"
                : "border-surface-border bg-surface hover:border-gray-600"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                method === "stripe_card" ? "border-brand-600" : "border-gray-600"
              }`}>
                {method === "stripe_card" && <div className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{t("onboarding.step4.stripeTitle")}</p>
                <p className="text-xs text-gray-400 mt-1">{t("onboarding.step4.stripeDesc")}</p>
              </div>
            </div>
          </button>
        </div>

        {/* Stripe Elements card form — key forces fresh mount = fresh SetupIntent */}
        {method === "stripe_card" && !cardSaved && stripePromise && (
          <Elements key={stripeFormKey} stripe={stripePromise} options={{ appearance: stripeAppearance }}>
            <OnboardingCardForm
              onSuccess={() => setCardSaved(true)}
              onError={(msg) => setError(msg)}
            />
          </Elements>
        )}

        {method === "stripe_card" && !stripePromise && (
          <div className="rounded-lg bg-blocked/10 border border-blocked/20 px-4 py-3 text-xs text-blocked">
            Stripe is not configured. Contact support.
          </div>
        )}

        {cardSaved && (
          <div className="rounded-lg bg-approved/10 border border-approved/20 px-4 py-3 text-sm text-approved">
            {t("onboarding.step4.cardSaved")}
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-blocked/10 border border-blocked/20 px-4 py-2 text-sm text-blocked">
            {error}
          </div>
        )}

        <div className="flex justify-between pt-2">
          <button
            onClick={() => router.push("/onboarding/step/3")}
            className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {t("common.back")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || (method === "stripe_card" && !cardSaved)}
            className="px-8 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50"
          >
            {submitting ? t("common.loading") : t("common.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
