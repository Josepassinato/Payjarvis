"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/nextjs";
import { useApi } from "@/lib/use-api";
import { LoadingSpinner, ErrorBox } from "@/components/loading";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface PaymentMethodRecord {
  id: string;
  userId: string;
  provider: string;
  status: "CONNECTED" | "PENDING" | "DISABLED";
  accountId: string | null;
  isDefault: boolean;
  metadata: { keyHint?: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface ProviderInfo {
  name: string;
  displayName: string;
  available: boolean;
}

interface PaymentMethodsResponse {
  methods: PaymentMethodRecord[];
  providers: ProviderInfo[];
}

async function fetchPaymentMethods(token: string | null): Promise<PaymentMethodsResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/payment-methods`, { headers });
  const json = await res.json();
  if (!res.ok || json.success === false) throw new Error(json.error ?? "Failed to fetch payment methods");
  return json.data ?? json;
}

export default function PaymentMethodsPage() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const { data, loading, error, refetch } = useApi<PaymentMethodsResponse>((token) => fetchPaymentMethods(token));
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [stripeKey, setStripeKey] = useState("");

  const PROVIDER_CARDS = [
    {
      id: "stripe",
      name: "Stripe",
      description: t("paymentMethods.stripeDesc"),
      icon: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z",
      comingSoon: false,
    },
    {
      id: "paypal",
      name: "PayPal",
      description: t("paymentMethods.paypalDesc"),
      icon: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      comingSoon: true,
    },
    {
      id: "apple-pay",
      name: "Apple Pay",
      description: t("paymentMethods.applePayDesc"),
      icon: "M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3",
      comingSoon: true,
    },
    {
      id: "google-pay",
      name: "Google Pay",
      description: t("paymentMethods.googlePayDesc"),
      icon: "M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM12 15.75h.008v.008H12v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z",
      comingSoon: true,
    },
  ];

  const getMethodForProvider = (id: string): PaymentMethodRecord | undefined => {
    const providerKey = id.replace("-", "_").toUpperCase();
    return data?.methods?.find((m) => m.provider === providerKey);
  };

  const isProviderAvailable = (id: string): boolean => {
    const providerKey = id.replace("-", "_").toLowerCase();
    const info = data?.providers?.find((p) => p.name === providerKey);
    return info?.available ?? false;
  };

  const handleSaveKey = async () => {
    if (!stripeKey.trim()) return;
    setActionLoading("stripe");
    setErrorMessage(null);
    try {
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_URL}/payment-methods/stripe/connect`, {
        method: "POST",
        headers,
        body: JSON.stringify({ stripeSecretKey: stripeKey.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        setErrorMessage(json.error ?? t("paymentMethods.saveKeyFailed"));
        return;
      }
      setSuccessMessage(t("paymentMethods.stripeSuccess"));
      setShowKeyForm(false);
      setStripeKey("");
      setTimeout(() => setSuccessMessage(null), 3000);
      refetch();
    } catch {
      setErrorMessage(t("paymentMethods.connectionError"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (providerId: string) => {
    setActionLoading(providerId);
    try {
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_URL}/payment-methods/${providerId}`, {
        method: "DELETE",
        headers,
      });
      const json = await res.json();
      if (!res.ok || json.success === false) throw new Error(json.error ?? "Failed to disconnect");
      refetch();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBox message={error} onRetry={refetch} />;

  return (
    <div className="max-w-4xl mx-auto">
      {successMessage && (
        <div className="mb-6 bg-approved/10 border border-approved/20 rounded-xl px-5 py-3 text-sm text-approved">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 bg-blocked/10 border border-blocked/20 rounded-xl px-5 py-3 text-sm text-blocked">
          {errorMessage}
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">{t("paymentMethods.title")}</h2>
        <p className="text-sm text-gray-500 mt-1">{t("paymentMethods.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        {PROVIDER_CARDS.map((card) => {
          const method = getMethodForProvider(card.id);
          const isConnected = method?.status === "CONNECTED";
          const available = isProviderAvailable(card.id);
          const isLoading = actionLoading === card.id;

          return (
            <div
              key={card.id}
              className="bg-surface-card border border-surface-border rounded-xl p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-surface-hover rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={card.icon} />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">{card.name}</h3>
                      {card.comingSoon && (
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-yellow-500/20 text-yellow-400 rounded-full">
                          {t("common.comingSoon")}
                        </span>
                      )}
                      {!card.comingSoon && isConnected && (
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-approved/20 text-approved rounded-full">
                          {t("paymentMethods.connected")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{card.description}</p>
                  </div>
                </div>

                {!card.comingSoon && isConnected && method?.accountId && (
                  <p className="text-xs text-gray-500 mb-1">
                    {t("paymentMethods.account")}: <span className="text-gray-400 font-mono">{method.accountId}</span>
                  </p>
                )}
                {!card.comingSoon && isConnected && (method?.metadata as any)?.keyHint && (
                  <p className="text-xs text-gray-500 mb-3">
                    {t("paymentMethods.key")}: <span className="text-gray-400 font-mono">{(method?.metadata as any).keyHint}</span>
                  </p>
                )}
              </div>

              <div className="mt-3">
                {card.comingSoon ? (
                  <button
                    disabled
                    className="w-full px-4 py-2 text-sm rounded-lg bg-surface-hover text-gray-600 cursor-not-allowed"
                  >
                    {t("common.comingSoon")}
                  </button>
                ) : isConnected ? (
                  <button
                    onClick={() => handleDisconnect(card.id)}
                    disabled={isLoading}
                    className="w-full px-4 py-2 text-sm rounded-lg bg-blocked/20 text-blocked hover:bg-blocked/30 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? t("common.disconnecting") : t("common.disconnect")}
                  </button>
                ) : card.id === "stripe" && showKeyForm ? (
                  <div className="space-y-2">
                    <input
                      type="password"
                      value={stripeKey}
                      onChange={(e) => setStripeKey(e.target.value)}
                      placeholder={t("paymentMethods.keyPlaceholder")}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-surface-hover border border-surface-border text-white placeholder-gray-500 font-mono focus:outline-none focus:border-brand-600"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveKey}
                        disabled={isLoading || !stripeKey.trim()}
                        className="flex-1 px-4 py-2 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-500 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? t("paymentMethods.validating") : t("common.save")}
                      </button>
                      <button
                        onClick={() => { setShowKeyForm(false); setStripeKey(""); setErrorMessage(null); }}
                        className="px-4 py-2 text-sm rounded-lg bg-surface-hover text-gray-400 hover:text-white transition-colors"
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                ) : !available ? (
                  <button
                    disabled
                    title="Configure STRIPE_SECRET_KEY"
                    className="w-full px-4 py-2 text-sm rounded-lg bg-surface-hover text-gray-600 cursor-not-allowed"
                  >
                    {t("common.configure")}
                  </button>
                ) : (
                  <button
                    onClick={() => { setShowKeyForm(true); setErrorMessage(null); }}
                    disabled={isLoading}
                    className="w-full px-4 py-2 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-500 transition-colors disabled:opacity-50"
                  >
                    {t("common.connect")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
