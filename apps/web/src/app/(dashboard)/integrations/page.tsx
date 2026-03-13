"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/nextjs";
import {
  getBots,
  getBotIntegrations,
  getAvailableIntegrations,
  toggleBotIntegration,
  type Bot,
  type BotIntegration,
  type AvailableProvider,
} from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { LoadingSpinner, ErrorBox } from "@/components/loading";
import { IntegrationGrid, type EnabledState } from "@/components/integration-grid";

export default function IntegrationsPage() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const { data: bots, loading: botsLoading, error: botsError } = useApi<Bot[]>((token) => getBots(token));

  const [selectedBot, setSelectedBot] = useState("");
  const [providers, setProviders] = useState<AvailableProvider[]>([]);
  const [enabled, setEnabled] = useState<EnabledState>({});
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Auto-select first bot
  useEffect(() => {
    if (bots && bots.length > 0 && !selectedBot) {
      setSelectedBot(bots[0].id);
    }
  }, [bots, selectedBot]);

  // Load integrations when bot changes
  const loadIntegrations = useCallback(async (botId: string) => {
    if (!botId) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const [available, existing] = await Promise.all([
        getAvailableIntegrations(token),
        getBotIntegrations(botId, token),
      ]);
      setProviders(available);

      const enabledMap: EnabledState = {};
      for (const integration of existing) {
        enabledMap[integration.provider] = integration.enabled;
      }
      setEnabled(enabledMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (selectedBot) loadIntegrations(selectedBot);
  }, [selectedBot, loadIntegrations]);

  const handleToggle = async (provider: string, category: string, newValue: boolean) => {
    if (!selectedBot) return;
    setToggling(provider);
    setSaveMessage(null);

    // Optimistic update
    setEnabled((prev) => ({ ...prev, [provider]: newValue }));

    try {
      const token = await getToken();
      await toggleBotIntegration(selectedBot, provider, category, newValue, token);
      setSaveMessage(t("integrations.saved"));
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (err) {
      // Revert on error
      setEnabled((prev) => ({ ...prev, [provider]: !newValue }));
      setError(err instanceof Error ? err.message : "Failed to toggle integration");
    } finally {
      setToggling(null);
    }
  };

  if (botsLoading) return <LoadingSpinner />;
  if (botsError) return <ErrorBox message={botsError} />;

  const enabledCount = Object.values(enabled).filter(Boolean).length;

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">{t("integrations.title")}</h2>
        <p className="text-sm text-gray-500 mt-1">{t("integrations.dashboardSubtitle")}</p>
      </div>

      {/* Bot selector */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex-1 max-w-sm">
          <label className="block text-xs text-gray-500 mb-1">{t("integrations.selectBot")}</label>
          <select
            value={selectedBot}
            onChange={(e) => setSelectedBot(e.target.value)}
            className="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
          >
            <option value="">{t("integrations.chooseBot")}</option>
            {(bots ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.platform})
              </option>
            ))}
          </select>
        </div>

        {saveMessage && (
          <span className="text-sm text-approved flex items-center gap-1 mt-5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {saveMessage}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-blocked/10 border border-blocked/20 px-4 py-2 text-sm text-blocked">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-xs">dismiss</button>
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : selectedBot && providers.length > 0 ? (
        <div className="bg-surface-card border border-surface-border rounded-xl p-6 space-y-6">
          {/* Summary bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="h-6 w-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center">
                {enabledCount}
              </span>
              {t("integrations.activeServices", { count: enabledCount })}
            </div>
          </div>

          <IntegrationGrid
            providers={providers}
            enabled={enabled}
            onToggle={handleToggle}
            toggling={toggling}
          />
        </div>
      ) : selectedBot ? (
        <div className="bg-surface-card border border-surface-border rounded-xl p-8 text-center">
          <p className="text-gray-500">{t("integrations.noProviders")}</p>
        </div>
      ) : null}
    </div>
  );
}
