"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getBots } from "@/lib/api";
import type { Bot } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { LoadingSpinner, ErrorBox } from "@/components/loading";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface OpenClawConfig {
  systemPrompt: string;
  tools: unknown[];
  botId: string;
  trustScore: number;
  limits: { perTransaction: number; perDay: number; autoApprove: number };
}

export default function IntegrationsPage() {
  const { t } = useTranslation();
  const { data: bots, loading, error } = useApi<Bot[]>((token) => getBots(token));
  const [selectedBot, setSelectedBot] = useState("");
  const [config, setConfig] = useState<OpenClawConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedTools, setCopiedTools] = useState(false);
  const [testUrl, setTestUrl] = useState("");
  const [testToken, setTestToken] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  const fetchConfig = async (botId: string) => {
    setSelectedBot(botId);
    setConfig(null);
    setConfigError(null);
    if (!botId) return;

    setConfigLoading(true);
    try {
      const res = await fetch(`${API_URL}/integrations/openclaw/config/${botId}`, {
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok || json.success === false) throw new Error(json.error ?? "Failed");
      setConfig(json.data);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : "Failed to fetch config");
    } finally {
      setConfigLoading(false);
    }
  };

  const handleCopy = async (text: string, setter: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const handleTest = async () => {
    if (!testUrl) return;
    setTestResult(null);
    try {
      const res = await fetch(testUrl + "/health");
      if (res.ok) {
        setTestResult(t("integrations.connectionOk"));
      } else {
        setTestResult(`Error: HTTP ${res.status}`);
      }
    } catch {
      setTestResult(t("integrations.connectionFailed"));
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBox message={error} />;

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">{t("integrations.title")}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {t("integrations.subtitle")}
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-xs text-gray-500 mb-1">{t("integrations.selectBot")}</label>
        <select
          value={selectedBot}
          onChange={(e) => fetchConfig(e.target.value)}
          className="w-full w-full sm:max-w-sm bg-surface-card border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
        >
          <option value="">{t("integrations.chooseBot")}</option>
          {(bots ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.platform})
            </option>
          ))}
        </select>
      </div>

      {configLoading && <LoadingSpinner />}
      {configError && <ErrorBox message={configError} />}

      {config && (
        <div className="space-y-6">
          <div className="bg-surface-card border border-surface-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300">{t("integrations.systemPrompt")}</h3>
              <button
                onClick={() => handleCopy(config.systemPrompt, setCopiedPrompt)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  copiedPrompt
                    ? "bg-approved/20 text-approved"
                    : "bg-surface-hover text-gray-400 hover:text-white"
                }`}
              >
                {copiedPrompt ? t("common.copied") : t("common.copy")}
              </button>
            </div>
            <textarea
              readOnly
              value={config.systemPrompt}
              rows={10}
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-gray-300 font-mono resize-none focus:outline-none"
            />
            <p className="text-xs text-gray-600 mt-2">
              {t("integrations.systemPromptHint")}
            </p>
          </div>

          <div className="bg-surface-card border border-surface-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-300">{t("integrations.toolsJson")}</h3>
              <button
                onClick={() =>
                  handleCopy(JSON.stringify(config.tools, null, 2), setCopiedTools)
                }
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  copiedTools
                    ? "bg-approved/20 text-approved"
                    : "bg-surface-hover text-gray-400 hover:text-white"
                }`}
              >
                {copiedTools ? t("common.copied") : t("integrations.copyJson")}
              </button>
            </div>
            <pre className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-green-400 font-mono overflow-x-auto max-h-64 overflow-y-auto">
              {JSON.stringify(config.tools, null, 2)}
            </pre>
          </div>

          <div className="bg-surface-card border border-surface-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">{t("integrations.testConnection")}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t("integrations.gatewayUrl")}</label>
                <input
                  type="text"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  placeholder="http://localhost:18789"
                  className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t("integrations.gatewayToken")}</label>
                <input
                  type="text"
                  value={testToken}
                  onChange={(e) => setTestToken(e.target.value)}
                  placeholder="Token..."
                  className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
                />
              </div>
              <button
                onClick={handleTest}
                className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500 transition-colors"
              >
                {t("integrations.test")}
              </button>
              {testResult && (
                <p
                  className={`text-sm ${
                    testResult === t("integrations.connectionOk") ? "text-approved" : "text-blocked"
                  }`}
                >
                  {testResult}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
