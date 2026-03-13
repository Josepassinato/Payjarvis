import { prisma } from "@payjarvis/database";

// ─── Trust level thresholds (agent scale 0-1000) ───

export const TrustLevel = {
  RESTRICTED: "RESTRICTED",
  STANDARD: "STANDARD",
  TRUSTED: "TRUSTED",
  AUTONOMOUS: "AUTONOMOUS",
} as const;

export type TrustLevelType = (typeof TrustLevel)[keyof typeof TrustLevel];

const TRUST_THRESHOLDS: { level: TrustLevelType; min: number }[] = [
  { level: TrustLevel.AUTONOMOUS, min: 800 },
  { level: TrustLevel.TRUSTED, min: 500 },
  { level: TrustLevel.STANDARD, min: 200 },
  { level: TrustLevel.RESTRICTED, min: 0 },
];

// Auto-approve dollar limits per trust level
const AUTO_APPROVE_LIMITS: Record<TrustLevelType, number> = {
  RESTRICTED: 0,
  STANDARD: 25,
  TRUSTED: 100,
  AUTONOMOUS: 500,
};

/**
 * Get the trust level label for a bot based on its agent trust score.
 * Falls back to bot.trustScore (converted to agent scale) if no agent exists.
 */
export async function getTrustLevel(botId: string): Promise<TrustLevelType> {
  const score = await resolveScore(botId);
  return scoreToLevel(score);
}

/**
 * Get the auto-approve dollar limit for a given trust level.
 */
export function getAutoApproveLimit(trustLevel: TrustLevelType): number {
  return AUTO_APPROVE_LIMITS[trustLevel] ?? 0;
}

/**
 * Determine if a bot action of the given amount requires human approval.
 * Compares amount against the auto-approve limit derived from the bot's trust level.
 */
export async function shouldRequireApproval(botId: string, amount: number): Promise<boolean> {
  const level = await getTrustLevel(botId);
  const limit = getAutoApproveLimit(level);
  return amount > limit;
}

// ─── Internal helpers ───

function scoreToLevel(score: number): TrustLevelType {
  for (const threshold of TRUST_THRESHOLDS) {
    if (score >= threshold.min) return threshold.level;
  }
  return TrustLevel.RESTRICTED;
}

async function resolveScore(botId: string): Promise<number> {
  // Prefer agent trust score (0-1000 scale)
  const agent = await prisma.agent.findUnique({ where: { botId } });
  if (agent) return agent.trustScore;

  // Fallback: bot trust score is 0-100, convert to 0-1000
  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (bot) return bot.trustScore * 10;

  return 0;
}
