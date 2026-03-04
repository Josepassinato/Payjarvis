"use client";

import { useState, useEffect } from "react";
import { getBot, upsertPolicy, linkTelegram } from "@/lib/api";
import type { Bot, Policy } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { TrustBar } from "@/components/trust-bar";
import { LoadingSpinner, ErrorBox } from "@/components/loading";

type PolicyForm = Omit<Policy, "id" | "botId" | "createdAt" | "updatedAt">;

const defaultPolicy: PolicyForm = {
  maxPerTransaction: 100,
  maxPerDay: 500,
  maxPerWeek: 2000,
  maxPerMonth: 5000,
  autoApproveLimit: 50,
  requireApprovalUp: 200,
  allowedDays: [1, 2, 3, 4, 5],
  allowedHoursStart: 8,
  allowedHoursEnd: 22,
  allowedCategories: [],
  blockedCategories: [],
  merchantWhitelist: [],
  merchantBlacklist: [],
};

const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

export default function BotDetailPage({ params }: { params: { id: string } }) {
  const { data: bot, loading, error, refetch } = useApi<Bot>(() => getBot(params.id), [params.id]);
  const [policy, setPolicy] = useState<PolicyForm>(defaultPolicy);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Telegram
  const [telegramCode, setTelegramCode] = useState<string | null>(null);
  const [linkingTelegram, setLinkingTelegram] = useState(false);
  const [copied, setCopied] = useState(false);

  // Advanced list inputs
  const [newAllowedCat, setNewAllowedCat] = useState("");
  const [newBlockedCat, setNewBlockedCat] = useState("");
  const [newWhitelist, setNewWhitelist] = useState("");
  const [newBlacklist, setNewBlacklist] = useState("");

  useEffect(() => {
    if (bot?.policy) {
      const { id, botId, createdAt, updatedAt, ...rest } = bot.policy;
      setPolicy(rest);
    }
  }, [bot]);

  const updateField = <K extends keyof PolicyForm>(key: K, value: PolicyForm[K]) => {
    setPolicy((p) => ({ ...p, [key]: value }));
    setSaved(false);
    setSaveError(null);
  };

  const toggleDay = (day: number) => {
    updateField(
      "allowedDays",
      policy.allowedDays.includes(day)
        ? policy.allowedDays.filter((d) => d !== day)
        : [...policy.allowedDays, day].sort()
    );
  };

  const addToList = (key: "allowedCategories" | "blockedCategories" | "merchantWhitelist" | "merchantBlacklist", value: string, setter: (v: string) => void) => {
    if (value.trim() && !policy[key].includes(value.trim())) {
      updateField(key, [...policy[key], value.trim()]);
      setter("");
    }
  };

  const removeFromList = (key: "allowedCategories" | "blockedCategories" | "merchantWhitelist" | "merchantBlacklist", value: string) => {
    updateField(key, policy[key].filter((v) => v !== value));
  };

  const handleSave = async () => {
    if (!bot) return;
    setSaving(true);
    setSaveError(null);
    try {
      await upsertPolicy(bot.id, policy);
      setSaved(true);
      refetch();
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleLinkTelegram = async () => {
    setLinkingTelegram(true);
    try {
      const result = await linkTelegram();
      setTelegramCode(result.code);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Falha ao gerar codigo");
    } finally {
      setLinkingTelegram(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBox message={error} onRetry={refetch} />;
  if (!bot) return <ErrorBox message="Bot not found" />;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">{bot.name}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {bot.platform} &middot; ID: {bot.id}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveError && <span className="text-xs text-blocked">{saveError}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              saved
                ? "bg-approved/20 text-approved"
                : "bg-brand-600 text-white hover:bg-brand-500"
            } disabled:opacity-50`}
          >
            {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar Alteracoes"}
          </button>
        </div>
      </div>

      {/* Trust Score */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Trust Score</h3>
        <TrustBar score={bot.trustScore} />
        <p className="text-xs text-gray-500 mt-2">
          {bot.totalApproved} aprovadas &middot; {bot.totalBlocked} bloqueadas
        </p>
      </div>

      {/* Simplified View — 3 Main Limit Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-surface-card border border-surface-border rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-2">Max por compra</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
            <input
              type="number"
              value={policy.maxPerTransaction}
              onChange={(e) => updateField("maxPerTransaction", Number(e.target.value))}
              className="w-full bg-surface border border-surface-border rounded-lg pl-8 pr-3 py-2 text-lg text-white font-mono focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>
        <div className="bg-surface-card border border-surface-border rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-2">Limite diario</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
            <input
              type="number"
              value={policy.maxPerDay}
              onChange={(e) => updateField("maxPerDay", Number(e.target.value))}
              className="w-full bg-surface border border-surface-border rounded-lg pl-8 pr-3 py-2 text-lg text-white font-mono focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>
        <div className="bg-surface-card border border-surface-border rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-2">Auto-aprovar ate</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
            <input
              type="number"
              value={policy.autoApproveLimit}
              onChange={(e) => updateField("autoApproveLimit", Number(e.target.value))}
              className="w-full bg-surface border border-surface-border rounded-lg pl-8 pr-3 py-2 text-lg text-white font-mono focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>
      </div>

      {/* Telegram Toggle */}
      <div className="bg-surface-card border border-surface-border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">&#x1f4e8;</span>
            <div>
              <h3 className="text-sm font-semibold text-gray-300">Notificacoes Telegram</h3>
              <p className="text-xs text-gray-500">Receba alertas quando seu bot precisar de aprovacao</p>
            </div>
          </div>
          <button
            onClick={handleLinkTelegram}
            disabled={linkingTelegram}
            className="px-4 py-2 text-xs bg-surface-hover text-gray-400 rounded-lg hover:text-white transition-colors disabled:opacity-50"
          >
            {linkingTelegram ? "Gerando..." : telegramCode ? "Gerar novo codigo" : "Vincular Telegram"}
          </button>
        </div>
        {telegramCode && (
          <div className="mt-3 bg-surface rounded-lg p-3 border border-brand-600/30">
            <p className="text-xs text-gray-400 mb-1">Envie para <span className="text-white">@PayJarvisBot</span>:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm text-white font-mono">/link {telegramCode}</code>
              <button
                onClick={() => handleCopy(`/link ${telegramCode}`)}
                className="px-3 py-1 text-xs bg-surface-hover text-gray-400 rounded-lg hover:text-white"
              >
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Advanced Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <span className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`}>&#x25B6;</span>
        Configuracoes avancadas
      </button>

      {/* Advanced Section (collapsible) */}
      {showAdvanced && (
        <>
          {/* Financial Limits (full) */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Limites Financeiros</h3>
            <div className="grid grid-cols-2 gap-4">
              {([
                ["maxPerTransaction", "Max por Transacao"],
                ["maxPerDay", "Max por Dia"],
                ["maxPerWeek", "Max por Semana"],
                ["maxPerMonth", "Max por Mes"],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                    <input
                      type="number"
                      value={policy[key]}
                      onChange={(e) => updateField(key, Number(e.target.value))}
                      className="w-full bg-surface border border-surface-border rounded-lg pl-10 pr-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Autonomy */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Autonomia por Faixa de Valor</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-approved/5 border border-approved/10 rounded-lg">
                <div className="w-3 h-3 rounded-full bg-approved" />
                <div className="flex-1">
                  <p className="text-sm text-white">Automatico</p>
                  <p className="text-xs text-gray-500">Aprovado sem intervencao humana</p>
                </div>
                <span className="text-sm text-gray-400">ate</span>
                <div className="relative w-32">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                  <input
                    type="number"
                    value={policy.autoApproveLimit}
                    onChange={(e) => updateField("autoApproveLimit", Number(e.target.value))}
                    className="w-full bg-surface border border-surface-border rounded-lg pl-9 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-pending/5 border border-pending/10 rounded-lg">
                <div className="w-3 h-3 rounded-full bg-pending" />
                <div className="flex-1">
                  <p className="text-sm text-white">Requer Aprovacao</p>
                  <p className="text-xs text-gray-500">Aguarda aprovacao humana</p>
                </div>
                <span className="text-sm text-gray-400">ate</span>
                <div className="relative w-32">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                  <input
                    type="number"
                    value={policy.requireApprovalUp}
                    onChange={(e) => updateField("requireApprovalUp", Number(e.target.value))}
                    className="w-full bg-surface border border-surface-border rounded-lg pl-9 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-blocked/5 border border-blocked/10 rounded-lg">
                <div className="w-3 h-3 rounded-full bg-blocked" />
                <div className="flex-1">
                  <p className="text-sm text-white">Bloqueado</p>
                  <p className="text-xs text-gray-500">Automaticamente rejeitado</p>
                </div>
                <span className="text-sm text-gray-400">acima de $ {policy.requireApprovalUp.toLocaleString("pt-BR")}</span>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-surface-card border border-surface-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Categorias Permitidas</h3>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {policy.allowedCategories.length === 0 && <span className="text-xs text-gray-600">Todas permitidas</span>}
                {policy.allowedCategories.map((cat) => (
                  <span key={cat} className="inline-flex items-center gap-1 px-2 py-1 bg-approved/10 text-approved text-xs rounded">
                    {cat}
                    <button onClick={() => removeFromList("allowedCategories", cat)} className="hover:text-white">&times;</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newAllowedCat} onChange={(e) => setNewAllowedCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addToList("allowedCategories", newAllowedCat, setNewAllowedCat)} placeholder="Adicionar categoria" className="flex-1 bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-500" />
                <button onClick={() => addToList("allowedCategories", newAllowedCat, setNewAllowedCat)} className="px-2 py-1.5 text-xs bg-surface-hover text-gray-400 rounded-lg hover:text-white">+</button>
              </div>
            </div>
            <div className="bg-surface-card border border-surface-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Categorias Bloqueadas</h3>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {policy.blockedCategories.length === 0 && <span className="text-xs text-gray-600">Nenhuma bloqueada</span>}
                {policy.blockedCategories.map((cat) => (
                  <span key={cat} className="inline-flex items-center gap-1 px-2 py-1 bg-blocked/10 text-blocked text-xs rounded">
                    {cat}
                    <button onClick={() => removeFromList("blockedCategories", cat)} className="hover:text-white">&times;</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newBlockedCat} onChange={(e) => setNewBlockedCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addToList("blockedCategories", newBlockedCat, setNewBlockedCat)} placeholder="Adicionar categoria" className="flex-1 bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-500" />
                <button onClick={() => addToList("blockedCategories", newBlockedCat, setNewBlockedCat)} className="px-2 py-1.5 text-xs bg-surface-hover text-gray-400 rounded-lg hover:text-white">+</button>
              </div>
            </div>
          </div>

          {/* Merchants */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-surface-card border border-surface-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Merchants Whitelist</h3>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {policy.merchantWhitelist.length === 0 && <span className="text-xs text-gray-600">Todos permitidos</span>}
                {policy.merchantWhitelist.map((m) => (
                  <span key={m} className="inline-flex items-center gap-1 px-2 py-1 bg-approved/10 text-approved text-xs rounded">
                    {m}
                    <button onClick={() => removeFromList("merchantWhitelist", m)} className="hover:text-white">&times;</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newWhitelist} onChange={(e) => setNewWhitelist(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addToList("merchantWhitelist", newWhitelist, setNewWhitelist)} placeholder="Adicionar merchant" className="flex-1 bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-500" />
                <button onClick={() => addToList("merchantWhitelist", newWhitelist, setNewWhitelist)} className="px-2 py-1.5 text-xs bg-surface-hover text-gray-400 rounded-lg hover:text-white">+</button>
              </div>
            </div>
            <div className="bg-surface-card border border-surface-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Merchants Blacklist</h3>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {policy.merchantBlacklist.length === 0 && <span className="text-xs text-gray-600">Nenhum bloqueado</span>}
                {policy.merchantBlacklist.map((m) => (
                  <span key={m} className="inline-flex items-center gap-1 px-2 py-1 bg-blocked/10 text-blocked text-xs rounded">
                    {m}
                    <button onClick={() => removeFromList("merchantBlacklist", m)} className="hover:text-white">&times;</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newBlacklist} onChange={(e) => setNewBlacklist(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addToList("merchantBlacklist", newBlacklist, setNewBlacklist)} placeholder="Adicionar merchant" className="flex-1 bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-500" />
                <button onClick={() => addToList("merchantBlacklist", newBlacklist, setNewBlacklist)} className="px-2 py-1.5 text-xs bg-surface-hover text-gray-400 rounded-lg hover:text-white">+</button>
              </div>
            </div>
          </div>

          {/* Time Window */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Janela de Operacao</h3>
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Dias Permitidos</p>
              <div className="flex gap-2">
                {dayNames.map((dayName, i) => (
                  <button
                    key={i}
                    onClick={() => toggleDay(i)}
                    className={`w-10 h-10 rounded-lg text-xs font-medium transition-colors ${
                      policy.allowedDays.includes(i)
                        ? "bg-brand-600 text-white"
                        : "bg-surface-hover text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {dayName}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Inicio</label>
                <select value={policy.allowedHoursStart} onChange={(e) => updateField("allowedHoursStart", Number(e.target.value))} className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500">
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                  ))}
                </select>
              </div>
              <span className="text-gray-500 mt-5">ate</span>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fim</label>
                <select value={policy.allowedHoursEnd} onChange={(e) => updateField("allowedHoursEnd", Number(e.target.value))} className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500">
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
