import type { BasePaymentProvider } from "./base.provider.js";
import { StripeProvider } from "./providers/stripe.provider.js";
import { PayPalProvider } from "./providers/paypal.provider.js";
import { ApplePayProvider } from "./providers/apple-pay.provider.js";
import { GooglePayProvider } from "./providers/google-pay.provider.js";

const providers: Record<string, BasePaymentProvider> = {
  stripe: new StripeProvider(),
  paypal: new PayPalProvider(),
  apple_pay: new ApplePayProvider(),
  google_pay: new GooglePayProvider(),
};

export function getPaymentProvider(name: string): BasePaymentProvider {
  const provider = providers[name.toLowerCase()];
  if (!provider) {
    throw new Error(`Unknown payment provider: ${name}`);
  }
  return provider;
}

export function getAvailableProviders(): { name: string; displayName: string; available: boolean }[] {
  return Object.values(providers).map((p) => ({
    name: p.name,
    displayName: p.displayName,
    available: p.isAvailable,
  }));
}

export function getDefaultProvider(): BasePaymentProvider {
  return providers.stripe;
}
