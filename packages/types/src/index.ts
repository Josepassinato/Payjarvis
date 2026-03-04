// ─── BDIT Token Payload ───

export interface BditPayload {
  bot_id: string;
  owner_id: string;
  trust_score: number;
  categories: string[];
  max_amount: number;
  merchant_id: string;
  amount: number;
  category: string;
  session_id: string;
  jti: string;
  iat: number;
  exp: number;
}

// ─── Decision Engine ───

export type Decision = "APPROVED" | "BLOCKED" | "PENDING_HUMAN";

export interface DecisionResult {
  decision: Decision;
  reason: string;
  ruleTriggered: string | null;
}

export interface PaymentRequest {
  botId: string;
  ownerId: string;
  merchantId: string;
  merchantName: string;
  amount: number;
  currency: string;
  category: string;
}

// ─── Policy ───

export interface PolicyConfig {
  maxPerTransaction: number;
  maxPerDay: number;
  maxPerWeek: number;
  maxPerMonth: number;
  autoApproveLimit: number;
  requireApprovalUp: number;
  allowedDays: number[];
  allowedHoursStart: number;
  allowedHoursEnd: number;
  allowedCategories: string[];
  blockedCategories: string[];
  merchantWhitelist: string[];
  merchantBlacklist: string[];
}

// ─── Bot ───

export interface BotInfo {
  id: string;
  ownerId: string;
  name: string;
  platform: string;
  status: string;
  trustScore: number;
  totalApproved: number;
  totalBlocked: number;
}

// ─── API Responses ───

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── Transaction Filters ───

export interface TransactionFilters {
  botId?: string;
  dateFrom?: string;
  dateTo?: string;
  decision?: Decision;
}

// ─── Approval Response ───

export interface ApprovalResponse {
  action: "approve" | "reject";
  reason?: string;
}

// ─── JWKS ───

export interface JwksKey {
  kty: string;
  use: string;
  kid: string;
  alg: string;
  n: string;
  e: string;
}

export interface JwksResponse {
  keys: JwksKey[];
}

// ─── Rules Engine Request/Response ───

export interface RulesEngineRequest {
  botId: string;
  ownerId: string;
  merchantId: string;
  merchantName: string;
  amount: number;
  category: string;
  policy: PolicyConfig;
  botTrustScore: number;
}

export interface RulesEngineResponse {
  decision: Decision;
  reason: string;
  ruleTriggered: string | null;
  evaluatedRules: RuleEvaluation[];
}

export interface RuleEvaluation {
  rule: string;
  passed: boolean;
  reason: string;
}
