export interface PaymentIntent {
  id: string;
  provider: string;
  amount: number;
  currency: string;
  status: "created" | "processing" | "succeeded" | "failed" | "cancelled";
  clientSecret?: string;
  redirectUrl?: string;
  metadata?: Record<string, string>;
}

export interface RefundResult {
  id: string;
  amount: number;
  status: "succeeded" | "pending" | "failed";
}

export abstract class BasePaymentProvider {
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract readonly isAvailable: boolean;

  abstract createPaymentIntent(params: {
    amount: number;
    currency: string;
    merchantAccountId: string;
    metadata?: Record<string, string>;
  }): Promise<PaymentIntent>;

  abstract refund(params: {
    paymentIntentId: string;
    amount?: number;
  }): Promise<RefundResult>;

  abstract getAccountStatus(accountId: string): Promise<{
    active: boolean;
    details?: Record<string, unknown>;
  }>;
}
