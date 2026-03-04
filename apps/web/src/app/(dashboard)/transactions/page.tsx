"use client";

import { useState, useCallback } from "react";
import { getBots, getTransactions, getTransactionsPdfUrl } from "@/lib/api";
import type { Bot, Transaction, TransactionFilters } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { DecisionBadge } from "@/components/decision-badge";
import { LoadingSpinner, ErrorBox, EmptyState } from "@/components/loading";
import { currency, shortDate } from "@/lib/format";

const decisionOptions = ["", "APPROVED", "BLOCKED", "PENDING_HUMAN"];
const decisionLabels: Record<string, string> = {
  "": "Todas decisões",
  APPROVED: "Aprovadas",
  BLOCKED: "Bloqueadas",
  PENDING_HUMAN: "Pendentes",
};

export default function TransactionsPage() {
  const [botFilter, setBotFilter] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filters: TransactionFilters = {};
  if (botFilter) filters.botId = botFilter;
  if (decisionFilter) filters.decision = decisionFilter;
  if (dateFrom) filters.dateFrom = dateFrom;
  if (dateTo) filters.dateTo = dateTo;

  const bots = useApi<Bot[]>(() => getBots());
  const txs = useApi<Transaction[]>(
    () => getTransactions(filters),
    [botFilter, decisionFilter, dateFrom, dateTo]
  );

  const handleExport = () => {
    window.open(getTransactionsPdfUrl(filters), "_blank");
  };

  if (txs.loading && !txs.data) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Transações</h2>
          <p className="text-sm text-gray-500 mt-1">Histórico completo de pagamentos</p>
        </div>
        <button
          onClick={handleExport}
          className="px-4 py-2.5 bg-surface-card border border-surface-border text-sm text-gray-300 rounded-lg hover:bg-surface-hover transition-colors"
        >
          Exportar PDF
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={botFilter}
          onChange={(e) => setBotFilter(e.target.value)}
          className="bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
        >
          <option value="">Todos os bots</option>
          {(bots.data ?? []).map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          value={decisionFilter}
          onChange={(e) => setDecisionFilter(e.target.value)}
          className="bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
        >
          {decisionOptions.map((opt) => (
            <option key={opt} value={opt}>{decisionLabels[opt]}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
        />
      </div>

      {txs.error && <ErrorBox message={txs.error} onRetry={txs.refetch} />}

      {!txs.error && (
        <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Bot</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Merchant</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Decisão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {(txs.data ?? []).map((tx) => {
                const botName = (bots.data ?? []).find((b) => b.id === tx.botId)?.name ?? tx.botId.slice(0, 8);
                return (
                  <tr key={tx.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-5 py-3.5 text-sm text-gray-400">{shortDate(tx.createdAt)}</td>
                    <td className="px-5 py-3.5 text-sm text-white">{botName}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-300">{tx.merchantName}</td>
                    <td className="px-5 py-3.5 text-sm font-mono text-right text-white">{currency(tx.amount, tx.currency)}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 bg-surface-hover rounded text-xs text-gray-400">{tx.category}</span>
                    </td>
                    <td className="px-5 py-3.5"><DecisionBadge decision={tx.decision} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(txs.data ?? []).length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">Nenhuma transação encontrada</div>
          )}
        </div>
      )}

      {txs.data && <p className="text-xs text-gray-600 mt-3">{txs.data.length} transações</p>}
    </div>
  );
}
