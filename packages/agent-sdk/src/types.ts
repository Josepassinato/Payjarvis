export interface PayJarvisConfig {
  apiKey: string;
  botId: string;
  baseUrl?: string;
  timeout?: number;
}

export interface ApprovalRequest {
  merchant: string;
  merchantId?: string;
  amount: number;
  category: string;
  description?: string;
  currency?: string;
}

export interface ApprovalDecision {
  approved: boolean;
  pending: boolean;
  blocked: boolean;
  transactionId: string;
  approvalId?: string;
  bditToken?: string;
  reason?: string;
  expiresAt?: string;
}

export interface SpendingLimits {
  perTransaction: number;
  perDay: number;
  perWeek: number;
  perMonth: number;
  spentToday: number;
  spentWeek: number;
  spentMonth: number;
  remainingToday: number;
  remainingWeek: number;
  remainingMonth: number;
}
