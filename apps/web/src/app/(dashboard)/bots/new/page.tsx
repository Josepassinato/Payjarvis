"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBot } from "@/lib/api";
import type { CreateBotResult } from "@/lib/api";

const platforms = [
  { value: "CUSTOM_API", label: "API" },
  { value: "TELEGRAM", label: "Telegram" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "DISCORD", label: "Discord" },
  { value: "SLACK", label: "Slack" },
];

export default function NewBotPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState("CUSTOM_API");
  const [creating, setCreating] = useState(false);
  const [createdBot, setCreatedBot] = useState<CreateBotResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyConfirmed, setKeyConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const result = await createBot(name.trim(), platform);
      setCreatedBot(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar bot");
    } finally {
      setCreating(false);
    }
  };

  const handleCopyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmAndGo = () => {
    if (createdBot) {
      router.push(`/bots/${createdBot.id}`);
    }
  };

  // Show API key modal after creation
  if (createdBot) {
    return (
      <div className="max-w-xl mx-auto mt-12">
        <div className="bg-surface-card border border-approved/30 rounded-xl p-6">
          <h2 className="text-xl font-bold text-approved mb-2">Bot criado com sucesso!</h2>
          <p className="text-sm text-gray-400 mb-1">
            <span className="text-white font-medium">{createdBot.name}</span> — {createdBot.platform}
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Policy padrão criada automaticamente. Você pode configurar limites na próxima tela.
          </p>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-blocked mb-2">
              Sua API Key — Esta chave não será exibida novamente. Guarde agora.
            </label>
            <div className="flex items-center gap-2 bg-surface rounded-lg p-3 border border-surface-border">
              <code className="flex-1 text-xs text-white font-mono break-all select-all">
                {createdBot.apiKey}
              </code>
              <button
                onClick={() => handleCopyKey(createdBot.apiKey)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors shrink-0 ${
                  copied ? "bg-approved/20 text-approved" : "bg-surface-hover text-gray-400 hover:text-white"
                }`}
              >
                {copied ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              id="confirm-key"
              checked={keyConfirmed}
              onChange={(e) => setKeyConfirmed(e.target.checked)}
              className="rounded border-surface-border"
            />
            <label htmlFor="confirm-key" className="text-xs text-gray-400">
              Confirmei que salvei a chave em local seguro
            </label>
          </div>

          <button
            onClick={handleConfirmAndGo}
            disabled={!keyConfirmed}
            className="w-full py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Configurar Policy do Bot
          </button>
        </div>
      </div>
    );
  }

  // Creation form
  return (
    <div className="max-w-xl mx-auto mt-12">
      <h2 className="text-2xl font-bold text-white mb-2">Novo Bot</h2>
      <p className="text-sm text-gray-500 mb-8">
        Crie um bot para gerenciar pagamentos. Uma policy padrão será criada automaticamente.
      </p>

      <div className="bg-surface-card border border-surface-border rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nome do Bot</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Meu Bot de Pagamentos"
            className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Plataforma</label>
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

        {error && (
          <p className="text-sm text-blocked">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="flex-1 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50"
          >
            {creating ? "Criando..." : "Criar Bot"}
          </button>
          <button
            onClick={() => router.push("/bots")}
            className="px-4 py-2.5 bg-surface-hover text-gray-400 text-sm rounded-lg hover:text-white transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
