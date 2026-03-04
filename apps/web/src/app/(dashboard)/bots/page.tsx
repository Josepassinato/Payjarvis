"use client";

import { useState } from "react";
import Link from "next/link";
import { getBots, createBot, updateBot } from "@/lib/api";
import type { Bot, CreateBotResult } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { TrustBar } from "@/components/trust-bar";
import { LoadingSpinner, ErrorBox } from "@/components/loading";
import { currency } from "@/lib/format";

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-approved/10 text-approved",
  PAUSED: "bg-pending/10 text-pending",
  REVOKED: "bg-blocked/10 text-blocked",
};
const statusLabels: Record<string, string> = {
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  REVOKED: "Revogado",
};

export default function BotsPage() {
  const { data: bots, loading, error, refetch } = useApi<Bot[]>(() => getBots());
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPlatform, setNewPlatform] = useState("CUSTOM_API");
  const [creating, setCreating] = useState(false);
  const [createdBot, setCreatedBot] = useState<CreateBotResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyConfirmed, setKeyConfirmed] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const result = await createBot(newName.trim(), newPlatform);
      setCreatedBot(result);
      setNewName("");
      setShowNew(false);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create bot");
    } finally {
      setCreating(false);
    }
  };

  const handleCopyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleStatus = async (bot: Bot) => {
    setActionLoading(bot.id);
    try {
      await updateBot(bot.id, { status: bot.status === "ACTIVE" ? "PAUSED" : "ACTIVE" });
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (bot: Bot) => {
    if (!confirm(`Revogar bot "${bot.name}"? Essa ação não pode ser desfeita.`)) return;
    setActionLoading(bot.id);
    try {
      await updateBot(bot.id, { status: "REVOKED" });
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBox message={error} onRetry={refetch} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Bots</h2>
          <p className="text-sm text-gray-500 mt-1">{(bots ?? []).length} bot(s) registrado(s)</p>
        </div>
        <button
          onClick={() => { setShowNew(!showNew); setCreatedBot(null); }}
          className="px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors"
        >
          + Novo Bot
        </button>
      </div>

      {/* API Key Modal */}
      {createdBot && (
        <div className="bg-surface-card border border-approved/30 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-approved mb-2">Bot criado com sucesso!</h3>
          <p className="text-xs text-blocked mb-3">Esta chave não será exibida novamente. Guarde agora.</p>
          <div className="flex items-center gap-2 bg-surface rounded-lg p-3 border border-surface-border">
            <code className="flex-1 text-xs text-white font-mono break-all select-all">{createdBot.apiKey}</code>
            <button
              onClick={() => handleCopyKey(createdBot.apiKey)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors shrink-0 ${
                copied ? "bg-approved/20 text-approved" : "bg-surface-hover text-gray-400 hover:text-white"
              }`}
            >
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <input
              type="checkbox"
              id="confirm-key"
              checked={keyConfirmed}
              onChange={(e) => setKeyConfirmed(e.target.checked)}
              className="rounded border-surface-border"
            />
            <label htmlFor="confirm-key" className="text-xs text-gray-400">
              Confirmei que salvei a chave
            </label>
          </div>
          <button
            onClick={() => { setCreatedBot(null); setKeyConfirmed(false); }}
            disabled={!keyConfirmed}
            className="mt-3 text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Create Form */}
      {showNew && !createdBot && (
        <div className="bg-surface-card border border-brand-600/30 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-white mb-4">Adicionar Novo Bot</h3>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do bot"
              className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <select
              value={newPlatform}
              onChange={(e) => setNewPlatform(e.target.value)}
              className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            >
              <option value="CUSTOM_API">API</option>
              <option value="TELEGRAM">Telegram</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="DISCORD">Discord</option>
              <option value="SLACK">Slack</option>
            </select>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-500 disabled:opacity-50"
            >
              {creating ? "Criando..." : "Criar"}
            </button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 bg-surface-hover text-gray-400 text-sm rounded-lg hover:text-white">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {(bots ?? []).length === 0 && !showNew ? (
        <div className="bg-surface-card border border-surface-border rounded-xl p-12 text-center">
          <p className="text-gray-400">Nenhum bot registrado</p>
          <p className="text-xs text-gray-600 mt-1">Clique em "+ Novo Bot" para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(bots ?? []).map((bot) => (
            <div key={bot.id} className="bg-surface-card border border-surface-border rounded-xl p-5 hover:border-surface-hover transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <Link href={`/bots/${bot.id}`} className="text-base font-semibold text-white hover:text-brand-400 transition-colors">
                    {bot.name}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5">{bot.platform}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyles[bot.status] ?? ""}`}>
                  {statusLabels[bot.status] ?? bot.status}
                </span>
              </div>

              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1.5">Trust Score</p>
                <TrustBar score={bot.trustScore} />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-xs text-gray-500">Aprovadas</p>
                  <p className="text-sm font-mono text-approved">{bot.totalApproved}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Bloqueadas</p>
                  <p className="text-sm font-mono text-blocked">{bot.totalBlocked}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-surface-border">
                <Link href={`/bots/${bot.id}`} className="px-3 py-1.5 text-xs text-brand-400 bg-brand-600/10 rounded hover:bg-brand-600/20 transition-colors">
                  Configurar
                </Link>
                {bot.status !== "REVOKED" && (
                  <button
                    onClick={() => handleToggleStatus(bot)}
                    disabled={actionLoading === bot.id}
                    className={`px-3 py-1.5 text-xs rounded transition-colors disabled:opacity-50 ${
                      bot.status === "ACTIVE"
                        ? "text-pending bg-pending/10 hover:bg-pending/20"
                        : "text-approved bg-approved/10 hover:bg-approved/20"
                    }`}
                  >
                    {bot.status === "ACTIVE" ? "Pausar" : "Ativar"}
                  </button>
                )}
                {bot.status !== "REVOKED" && (
                  <button
                    onClick={() => handleRevoke(bot)}
                    disabled={actionLoading === bot.id}
                    className="px-3 py-1.5 text-xs text-blocked bg-blocked/10 rounded hover:bg-blocked/20 transition-colors disabled:opacity-50"
                  >
                    Revogar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
