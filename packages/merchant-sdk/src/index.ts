import { BditVerifier } from "@payjarvis/bdit";

export interface VerifyResult {
  valid: boolean;
  bot?: {
    id: string;
    trustScore: number;
    merchantId: string;
    amount: number;
    category: string;
  };
  reason?: string;
}

export interface PayjarvisVerifierConfig {
  merchantId: string;
  publicKey?: string;
  jwksUrl?: string;
  minTrustScore?: number;
}

export class PayjarvisVerifier {
  private verifier: BditVerifier;
  private merchantId: string;
  private minTrustScore: number;

  constructor(config: PayjarvisVerifierConfig) {
    this.merchantId = config.merchantId;
    this.minTrustScore = config.minTrustScore ?? 50;

    if (config.publicKey) {
      this.verifier = BditVerifier.fromPublicKey(config.publicKey);
    } else if (config.jwksUrl) {
      this.verifier = BditVerifier.fromJwks(config.jwksUrl);
    } else {
      throw new Error("Either publicKey or jwksUrl must be provided");
    }
  }

  async verify(token: string): Promise<VerifyResult> {
    const result = await this.verifier.verify(token);

    if (!result.valid || !result.payload) {
      return { valid: false, reason: result.error ?? "Invalid token" };
    }

    const payload = result.payload;

    // Verify merchant
    if (payload.merchant_id !== this.merchantId) {
      return { valid: false, reason: `Token merchant ${payload.merchant_id} does not match ${this.merchantId}` };
    }

    // Verify trust score
    if (payload.trust_score < this.minTrustScore) {
      return {
        valid: false,
        reason: `Trust score ${payload.trust_score} below minimum ${this.minTrustScore}`,
      };
    }

    return {
      valid: true,
      bot: {
        id: payload.bot_id,
        trustScore: payload.trust_score,
        merchantId: payload.merchant_id,
        amount: payload.amount,
        category: payload.category,
      },
    };
  }
}

export function extractToken(request: {
  headers?: Record<string, string | undefined>;
  cookies?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
}): string | null {
  // 1. x-payjarvis-token header
  if (request.headers?.["x-payjarvis-token"]) {
    return request.headers["x-payjarvis-token"];
  }

  // 2. Authorization Bearer
  const auth = request.headers?.authorization;
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7);
  }

  // 3. Cookie __payjarvis_bdit
  if (request.cookies?.__payjarvis_bdit) {
    return request.cookies.__payjarvis_bdit;
  }

  // 4. Body payjarvis_token
  if (typeof request.body?.payjarvis_token === "string") {
    return request.body.payjarvis_token;
  }

  return null;
}

// Universal adapter script content for CDN embedding
export const ADAPTER_SCRIPT = `
(function() {
  'use strict';
  var merchantId = document.currentScript.getAttribute('data-merchant');
  if (!merchantId) { console.error('[PayJarvis] data-merchant attribute required'); return; }

  window.PayJarvis = {
    merchantId: merchantId,
    verify: function(token) {
      return fetch('https://api.payjarvis.com/.well-known/jwks.json')
        .then(function(r) { return r.json(); })
        .then(function(jwks) {
          // Client-side JWT verification (simplified for adapter)
          var parts = token.split('.');
          if (parts.length !== 3) return { valid: false, reason: 'Invalid token format' };
          try {
            var payload = JSON.parse(atob(parts[1]));
            if (payload.merchant_id !== merchantId) return { valid: false, reason: 'Merchant mismatch' };
            if (payload.exp * 1000 < Date.now()) return { valid: false, reason: 'Token expired' };
            return { valid: true, bot: payload };
          } catch(e) {
            return { valid: false, reason: 'Parse error' };
          }
        });
    },
    extractToken: function() {
      var params = new URLSearchParams(window.location.search);
      return params.get('payjarvis_token') || null;
    }
  };
})();
`;
