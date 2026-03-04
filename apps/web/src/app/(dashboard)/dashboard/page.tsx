"use client";

import { getBots, getTransactions } from "@/lib/api";
import type { Bot, Transaction, PaginatedResult } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { StatCard } from "@/components/stat-card";
import { DecisionBadge } from "@/components/decision-badge";
import { LoadingSpinner, ErrorBox } from "@/components/loading";
import { currency, shortDate } from "@/lib/format";

export default function DashboardPage() {
  const bots = useApi<Bot[]>(() => getBots());
  const txs = useApi<PaginatedResult<Transaction>>(() => getTransactions({ limit: 100 }));

  if (bots.loading || txs.loading) return <LoadingSpinner />;
  if (bots.error) return <ErrorBox message={bots.error} onRetry={bots.refetch} />;
  if (txs.error) return <ErrorBox message={txs.error} onRetry={txs.refetch} />;

  const allBots = bots.data ?? [];
  const allTxs = txs.data?.data ?? [];

  const activeBots = allBots.filter((b) => b.status === "ACTIVE").length;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyTxs = allTxs.filter(
    (t) => t.decision === "APPROVED" && new Date(t.createdAt) >= startOfMonth
  );
  const monthlySpend = monthlyTxs.reduce((sum, t) => sum + t.amount, 0);
  const pendingCount = allTxs.filter((t) => t.decision === "PENDING_HUMAN").length;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const blockedToday = allTxs.filter(
    (t) => t.decision === "BLOCKED" && new Date(t.createdAt) >= todayStart
  ).length;
  const recentTxs = allTxs.slice(0, 5);

  // Suspicious: bots with high block rate
  const suspiciousAlerts = allBots
    .filter((b) => b.totalBlocked > 3)
    .map((b) => ({
      id: b.id,
      name: b.name,
      message: `${b.totalBlocked} transações bloqueadas (trust score: ${b.trustScore})`,
    }));

  // Bots near monthly limit
  const nearLimitAlerts = allBots
    .filter((b) => b.policy && b.policy.maxPerMonth > 0)
    .map((b) => {
      const botMonthly = monthlyTxs
        .filter((t) => t.botId === b.id)
        .reduce((s, t) => s + t.amount, 0);
      const pct = b.policy ? (botMonthly / b.policy.maxPerMonth) * 100 : 0;
      return { id: b.id, name: b.name, pct, message: `atingiu ${pct.toFixed(0)}% do limite mensal` };
    })
    .filter((a) => a.pct >= 70);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">Visão geral do PayJarvis</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Bots Ativos" value={activeBots} color="text-brand-400" />
        <StatCard label="Gasto no Mês" value={currency(monthlySpend)} color="text-approved" />
        <StatCard label="Aprovações Pendentes" value={pendingCount} color="text-pending" />
        <StatCard label="Bloqueados Hoje" value={blockedToday} color="text-blocked" />
      </div>

      <div className="bg-surface-card border border-surface-border rounded-xl">
        <div className="px-5 py-4 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-gray-300">Últimas Transações</h3>
        </div>
        {recentTxs.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">Nenhuma transação ainda</div>
        ) : (
          <div className="divide-y divide-surface-border">
            {recentTxs.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-hover transition-colors">
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{tx.merchantName}</p>
                  <p className="text-xs text-gray-500">{tx.category} &middot; {shortDate(tx.createdAt)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-gray-200">{currency(tx.amount, tx.currency)}</span>
                  <DecisionBadge decision={tx.decision} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(suspiciousAlerts.length > 0 || nearLimitAlerts.length > 0) && (
        <div className="mt-6 bg-surface-card border border-surface-border rounded-xl">
          <div className="px-5 py-4 border-b border-surface-border">
            <h3 className="text-sm font-semibold text-gray-300">Alertas de Comportamento Suspeito</h3>
          </div>
          <div className="divide-y divide-surface-border">
            {suspiciousAlerts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-2 h-2 rounded-full bg-blocked" />
                <p className="text-sm text-gray-300">
                  <span className="text-white font-medium">{a.name}</span> — {a.message}
                </p>
              </div>
            ))}
            {nearLimitAlerts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-2 h-2 rounded-full bg-pending" />
                <p className="text-sm text-gray-300">
                  <span className="text-white font-medium">{a.name}</span> {a.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
