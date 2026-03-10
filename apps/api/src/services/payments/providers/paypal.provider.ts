import {
  BasePaymentProvider,
  type PaymentIntent,
  type RefundResult,
} from "../base.provider.js";

export class PayPalProvider extends BasePaymentProvider {
  readonly name = "paypal";
  readonly displayName = "PayPal";

  get isAvailable(): boolean {
    return false; // Not yet implemented
  }

  async createPaymentIntent(): Promise<PaymentIntent> {
    throw new Error("PayPal provider is not yet implemented");
  }

  async refund(): Promise<RefundResult> {
    throw new Error("PayPal provider is not yet implemented");
  }

  async getAccountStatus(): Promise<{ active: boolean }> {
    return { active: false };
  }
}
