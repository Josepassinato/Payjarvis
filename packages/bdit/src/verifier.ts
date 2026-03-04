import { jwtVerify, importSPKI, createRemoteJWKSet } from "jose";
import type { BditPayload } from "@payjarvis/types";

export interface VerifyResult {
  valid: boolean;
  payload?: BditPayload;
  error?: string;
}

export class BditVerifier {
  private publicKeyPem?: string;
  private jwksUrl?: string;

  /**
   * Create a verifier using a local public key (no API call needed)
   */
  static fromPublicKey(publicKeyPem: string): BditVerifier {
    const verifier = new BditVerifier();
    verifier.publicKeyPem = publicKeyPem;
    return verifier;
  }

  /**
   * Create a verifier using a JWKS endpoint
   */
  static fromJwks(jwksUrl: string): BditVerifier {
    const verifier = new BditVerifier();
    verifier.jwksUrl = jwksUrl;
    return verifier;
  }

  async verify(token: string): Promise<VerifyResult> {
    try {
      let result;

      if (this.publicKeyPem) {
        const publicKey = await importSPKI(this.publicKeyPem, "RS256");
        result = await jwtVerify(token, publicKey, {
          issuer: "payjarvis",
          algorithms: ["RS256"],
        });
      } else if (this.jwksUrl) {
        const jwks = createRemoteJWKSet(new URL(this.jwksUrl));
        result = await jwtVerify(token, jwks, {
          issuer: "payjarvis",
          algorithms: ["RS256"],
        });
      } else {
        return { valid: false, error: "No verification key configured" };
      }

      const payload = result.payload as unknown as BditPayload;

      // Validate required fields
      if (!payload.bot_id || !payload.jti || !payload.merchant_id) {
        return { valid: false, error: "Missing required BDIT fields" };
      }

      return { valid: true, payload };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown verification error";
      return { valid: false, error: message };
    }
  }
}
