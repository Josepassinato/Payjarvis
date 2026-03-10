import {
  BasePaymentProvider,
  type PaymentIntent,
  type RefundResult,
} from "../base.provider.js";

export class ApplePayProvider extends BasePaymentProvider {
  readonly name = "apple_pay";
  readonly displayName = "Apple Pay";

  get isAvailable(): boolean {
    return false; // Enabled via Stripe — not standalone yet
  }

  async createPaymentIntent(): Promise<PaymentIntent> {
    throw new Error("Apple Pay provider is not yet implemented (will use Stripe)");
  }

  async refund(): Promise<RefundResult> {
    throw new Error("Apple Pay provider is not yet implemented");
  }

  async getAccountStatus(): Promise<{ active: boolean }> {
    return { active: false };
  }
}
