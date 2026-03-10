"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useAuth } from "@clerk/nextjs";
import { getBots, updateBotStatus } from "@/lib/api";
import type { Bot } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { TrustBar } from "@/components/trust-bar";
import { LoadingSpinner, ErrorBox } from "@/components/loading";

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-approved/10 text-approved",
  PAUSED: "bg-pending/10 text-pending",
  REVOKED: "bg-blocked/10 text-blocked",
};

export default function BotsPage() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const { data: bots, loading, error, refetch } = useApi<Bot[]>((token) => getBots(token));
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const statusLabels: Record<string, string> = {
    ACTIVE: t("bots.statusActive"),
    PAUSED: t("bots.statusPaused"),
    REVOKED: t("bots.statusRevoked"),
  };

  const handleStatusChange = async (bot: Bot, newStatus: string) => {
    if (newStatus === "REVOKED" && !confirm(t("bots.revokeConfirm", { name: bot.name }))) return;
    setActionLoading(bot.id);
    try {
      const token = await getToken();
      await updateBotStatus(bot.id, newStatus, token);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("bots.failedUpdate"));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBox message={error} onRetry={refetch} />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">{t("bots.title")}</h2>
          <p className="text-sm text-gray-500 mt-1">{t("bots.count", { count: (bots ?? []).length })}</p>
        </div>
        <Link
          href="/bots/new"
          className="px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors"
        >
          {t("bots.newBot")}
        </Link>
      </div>

      {(bots ?? []).length === 0 ? (
        <div className="bg-surface-card border border-surface-border rounded-xl p-12 text-center">
          <p className="text-gray-400">{t("bots.noBots")}</p>
          <p className="text-xs text-gray-600 mt-1">{t("bots.noBotsHint")}</p>
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
                <p className="text-xs text-gray-500 mb-1.5">{t("bots.trustScore")}</p>
                <TrustBar score={bot.trustScore} />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-xs text-gray-500">{t("decisions.approved")}</p>
                  <p className="text-sm font-mono text-approved">{bot.totalApproved}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t("decisions.blocked")}</p>
                  <p className="text-sm font-mono text-blocked">{bot.totalBlocked}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-surface-border">
                <Link href={`/bots/${bot.id}`} className="px-3 py-1.5 text-xs text-brand-400 bg-brand-600/10 rounded hover:bg-brand-600/20 transition-colors">
                  {t("common.configure")}
                </Link>
                {bot.status === "ACTIVE" && (
                  <button
                    onClick={() => handleStatusChange(bot, "PAUSED")}
                    disabled={actionLoading === bot.id}
                    className="px-3 py-1.5 text-xs text-pending bg-pending/10 rounded hover:bg-pending/20 transition-colors disabled:opacity-50"
                  >
                    {t("bots.pause")}
                  </button>
                )}
                {bot.status === "PAUSED" && (
                  <button
                    onClick={() => handleStatusChange(bot, "ACTIVE")}
                    disabled={actionLoading === bot.id}
                    className="px-3 py-1.5 text-xs text-approved bg-approved/10 rounded hover:bg-approved/20 transition-colors disabled:opacity-50"
                  >
                    {t("bots.reactivate")}
                  </button>
                )}
                {bot.status !== "REVOKED" && (
                  <button
                    onClick={() => handleStatusChange(bot, "REVOKED")}
                    disabled={actionLoading === bot.id}
                    className="px-3 py-1.5 text-xs text-blocked bg-blocked/10 rounded hover:bg-blocked/20 transition-colors disabled:opacity-50"
                  >
                    {t("bots.revoke")}
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
