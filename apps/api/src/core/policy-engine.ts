import { prisma } from "@payjarvis/database";
import { logEvent, AuditEvents } from "./audit-logger.js";

// ─── Types ───

export interface PolicyAction {
  type: string;
  amount?: number;
  category?: string;
  merchantId?: string;
  provider?: string;
}

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  requiresApproval: boolean;
}

/**
 * Evaluate whether a bot action is permitted based on the bot's policy.
 *
 * Checks:
 * 1. Policy existence
 * 2. Allowed days / hours (timezone-aware)
 * 3. Category whitelist (if configured)
 * 4. Merchant blacklist
 * 5. Per-transaction limit
 * 6. Daily spending limit
 * 7. Weekly spending limit
 * 8. Monthly spending limit
 * 9. Auto-approve threshold (requiresApproval flag)
 */
export async function evaluatePolicy(
  botId: string,
  action: PolicyAction
): Promise<PolicyDecision> {
  const policy = await prisma.policy.findUnique({ where: { botId } });

  if (!policy) {
    return { allowed: false, reason: "No policy configured for this bot", requiresApproval: false };
  }

  const amount = action.amount ?? 0;

  // ─── Time window check ───
  const now = new Date();
  let currentDay: number;
  let currentHour: number;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: policy.timezone,
      weekday: "short",
      hour: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const weekdayPart = parts.find((p) => p.type === "weekday")?.value ?? "";
    const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0";
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    currentDay = dayMap[weekdayPart] ?? now.getDay();
    currentHour = parseInt(hourPart, 10);
  } catch {
    currentDay = now.getDay();
    currentHour = now.getHours();
  }

  if (policy.allowedDays.length > 0 && !policy.allowedDays.includes(currentDay)) {
    const decision: PolicyDecision = { allowed: false, reason: "Transaction not allowed on this day", requiresApproval: false };
    await logDecision(botId, action, decision, "checkDay");
    return decision;
  }

  if (currentHour < policy.allowedHoursStart || currentHour >= policy.allowedHoursEnd) {
    const decision: PolicyDecision = { allowed: false, reason: `Transactions only allowed between ${policy.allowedHoursStart}:00-${policy.allowedHoursEnd}:00`, requiresApproval: false };
    await logDecision(botId, action, decision, "checkTimeWindow");
    return decision;
  }

  // ─── Category check ───
  if (action.category && policy.allowedCategories.length > 0) {
    if (!policy.allowedCategories.includes(action.category)) {
      const decision: PolicyDecision = { allowed: false, reason: `Category "${action.category}" is not allowed`, requiresApproval: false };
      await logDecision(botId, action, decision, "checkCategory");
      return decision;
    }
  }

  if (action.category && policy.blockedCategories.length > 0) {
    if (policy.blockedCategories.includes(action.category)) {
      const decision: PolicyDecision = { allowed: false, reason: `Category "${action.category}" is blocked`, requiresApproval: false };
      await logDecision(botId, action, decision, "checkCategory");
      return decision;
    }
  }

  // ─── Merchant blacklist ───
  if (action.merchantId && policy.merchantBlacklist.length > 0) {
    if (policy.merchantBlacklist.includes(action.merchantId)) {
      const decision: PolicyDecision = { allowed: false, reason: "Merchant is blacklisted", requiresApproval: false };
      await logDecision(botId, action, decision, "checkMerchant");
      return decision;
    }
  }

  // ─── Merchant whitelist (if configured, only whitelisted merchants allowed) ───
  if (action.merchantId && policy.merchantWhitelist.length > 0) {
    if (!policy.merchantWhitelist.includes(action.merchantId)) {
      const decision: PolicyDecision = { allowed: false, reason: "Merchant is not in whitelist", requiresApproval: false };
      await logDecision(botId, action, decision, "checkMerchant");
      return decision;
    }
  }

  // ─── Per-transaction limit ───
  if (amount > policy.maxPerTransaction) {
    const decision: PolicyDecision = { allowed: false, reason: `Amount $${amount} exceeds per-transaction limit of $${policy.maxPerTransaction}`, requiresApproval: false };
    await logDecision(botId, action, decision, "checkTransactionLimit");
    return decision;
  }

  // ─── Spending limits (daily, weekly, monthly) ───
  const spendingCheck = await checkSpendingLimits(botId, amount, policy);
  if (!spendingCheck.allowed) {
    await logDecision(botId, action, spendingCheck, spendingCheck.reason.includes("daily") ? "checkDailyLimit" : spendingCheck.reason.includes("weekly") ? "checkWeeklyLimit" : "checkMonthlyLimit");
    return spendingCheck;
  }

  // ─── Auto-approve threshold ───
  const requiresApproval = amount > policy.autoApproveLimit;
  const decision: PolicyDecision = {
    allowed: true,
    reason: requiresApproval ? `Amount $${amount} exceeds auto-approve limit of $${policy.autoApproveLimit}` : "Policy check passed",
    requiresApproval,
  };

  await logDecision(botId, action, decision, "passed");
  return decision;
}

// ─── Internal helpers ───

async function checkSpendingLimits(
  botId: string,
  amount: number,
  policy: { maxPerDay: number; maxPerWeek: number; maxPerMonth: number }
): Promise<PolicyDecision> {
  const now = new Date();

  // Daily total
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dailyTotal = await getSpendingTotal(botId, dayStart);
  if (dailyTotal + amount > policy.maxPerDay) {
    return { allowed: false, reason: `Would exceed daily limit of $${policy.maxPerDay} (spent today: $${dailyTotal.toFixed(2)})`, requiresApproval: false };
  }

  // Weekly total
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weeklyTotal = await getSpendingTotal(botId, weekStart);
  if (weeklyTotal + amount > policy.maxPerWeek) {
    return { allowed: false, reason: `Would exceed weekly limit of $${policy.maxPerWeek} (spent this week: $${weeklyTotal.toFixed(2)})`, requiresApproval: false };
  }

  // Monthly total
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyTotal = await getSpendingTotal(botId, monthStart);
  if (monthlyTotal + amount > policy.maxPerMonth) {
    return { allowed: false, reason: `Would exceed monthly limit of $${policy.maxPerMonth} (spent this month: $${monthlyTotal.toFixed(2)})`, requiresApproval: false };
  }

  return { allowed: true, reason: "Within spending limits", requiresApproval: false };
}

async function getSpendingTotal(botId: string, since: Date): Promise<number> {
  const result = await prisma.transaction.aggregate({
    where: {
      botId,
      decision: "APPROVED",
      createdAt: { gte: since },
    },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

async function logDecision(
  botId: string,
  action: PolicyAction,
  decision: PolicyDecision,
  ruleTriggered: string
): Promise<void> {
  await logEvent({
    botId,
    event: AuditEvents.POLICY_DECISION,
    layer: 1,
    payload: {
      actionType: action.type,
      amount: action.amount,
      category: action.category,
      merchantId: action.merchantId,
      provider: action.provider,
      allowed: decision.allowed,
      reason: decision.reason,
      requiresApproval: decision.requiresApproval,
      ruleTriggered,
    },
  });
}
