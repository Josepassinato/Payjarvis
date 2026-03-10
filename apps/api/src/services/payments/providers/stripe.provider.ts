import Stripe from "stripe";
import {
  BasePaymentProvider,
  type PaymentIntent,
  type RefundResult,
} from "../base.provider.js";

export class StripeProvider extends BasePaymentProvider {
  readonly name = "stripe";
  readonly displayName = "Stripe";
  private stripe: Stripe | null = null;

  get isAvailable(): boolean {
    return !!process.env.STRIPE_SECRET_KEY;
  }

  private getClient(): Stripe {
    if (!this.stripe) {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
      this.stripe = new Stripe(key);
    }
    return this.stripe;
  }

  /** Validate a user-provided Stripe secret key by calling the Stripe API */
  async validateSecretKey(secretKey: string): Promise<{ valid: boolean; accountName?: string }> {
    try {
      const testClient = new Stripe(secretKey);
      const account = await testClient.accounts.retrieve();
      return {
        valid: true,
        accountName: account.settings?.dashboard?.display_name ?? account.business_profile?.name ?? undefined,
      };
    } catch {
      return { valid: false };
    }
  }

  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    merchantAccountId: string;
    metadata?: Record<string, string>;
  }): Promise<PaymentIntent> {
    const stripe = this.getClient();

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(params.amount * 100), // cents
      currency: params.currency.toLowerCase(),
      metadata: {
        ...params.metadata,
        provider: "payjarvis",
      },
      transfer_data: {
        destination: params.merchantAccountId,
      },
    });

    return {
      id: intent.id,
      provider: this.name,
      amount: params.amount,
      currency: params.currency,
      status: "created",
      clientSecret: intent.client_secret ?? undefined,
    };
  }

  async refund(params: {
    paymentIntentId: string;
    amount?: number;
  }): Promise<RefundResult> {
    const stripe = this.getClient();

    const refund = await stripe.refunds.create({
      payment_intent: params.paymentIntentId,
      amount: params.amount ? Math.round(params.amount * 100) : undefined,
    });

    return {
      id: refund.id,
      amount: (refund.amount ?? 0) / 100,
      status: refund.status === "succeeded" ? "succeeded" : "pending",
    };
  }

  async getAccountStatus(accountId: string): Promise<{
    active: boolean;
    details?: Record<string, unknown>;
  }> {
    const stripe = this.getClient();

    try {
      const account = await stripe.accounts.retrieve(accountId);
      return {
        active: account.charges_enabled ?? false,
        details: {
          payoutsEnabled: account.payouts_enabled,
          country: account.country,
          defaultCurrency: account.default_currency,
        },
      };
    } catch {
      return { active: false };
    }
  }
}
