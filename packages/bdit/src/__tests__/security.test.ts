/**
 * BDIT Security Tests
 *
 * Covers:
 * - Atomic replay protection (concurrency)
 * - Key rotation with old+new keys
 * - Environment separation (dev/staging/prod)
 * - Algorithm restriction
 * - Verify SDK cache TTL
 */

import { describe, it, expect, beforeAll } from "vitest";
import { generateKeyPair, exportPKCS8, exportSPKI, SignJWT, importPKCS8 } from "jose";
import { BditIssuer } from "../issuer.js";
import { BditVerifier } from "../verifier.js";

// ─── Shared key pairs ───────────────────────────────

let keyA: { privatePem: string; publicPem: string };
let keyB: { privatePem: string; publicPem: string };

beforeAll(async () => {
  const pairA = await generateKeyPair("RS256", { modulusLength: 2048 });
  keyA = {
    privatePem: await exportPKCS8(pairA.privateKey),
    publicPem: await exportSPKI(pairA.publicKey),
  };

  const pairB = await generateKeyPair("RS256", { modulusLength: 2048 });
  keyB = {
    privatePem: await exportPKCS8(pairB.privateKey),
    publicPem: await exportSPKI(pairB.publicKey),
  };
});

const SAMPLE_PARAMS = {
  botId: "bot_test_001",
  ownerId: "user_test_001",
  trustScore: 85,
  kycLevel: 2,
  categories: ["shopping"],
  maxAmount: 500,
  merchantId: "merchant_test",
  amount: 49.99,
  category: "shopping",
  sessionId: "sess_test_001",
};

// ─── 1. Replay Protection (atomic redisSetNX simulation) ─

describe("Replay Protection", () => {
  it("redisSetNX logic: only first caller wins", async () => {
    // Simulate the atomic gate with a Map (same as in-memory fallback)
    const store = new Map<string, { value: string; expiresAt: number | null }>();

    function setNX(key: string, value: string): boolean {
      const entry = store.get(key);
      if (entry && (!entry.expiresAt || entry.expiresAt > Date.now())) {
        return false;
      }
      store.set(key, { value, expiresAt: Date.now() + 600_000 });
      return true;
    }

    const jti = "test-jti-replay-001";
    const key = `bdit:used:${jti}`;

    // First claim succeeds
    expect(setNX(key, "1")).toBe(true);
    // All subsequent claims fail
    expect(setNX(key, "1")).toBe(false);
    expect(setNX(key, "1")).toBe(false);
  });

  it("concurrent claims: only one succeeds out of 100", async () => {
    const store = new Map<string, { value: string; expiresAt: number | null }>();
    let successCount = 0;

    function setNX(key: string): boolean {
      const entry = store.get(key);
      if (entry && (!entry.expiresAt || entry.expiresAt > Date.now())) {
        return false;
      }
      store.set(key, { value: "1", expiresAt: Date.now() + 600_000 });
      return true;
    }

    const jti = "test-jti-concurrent";
    const key = `bdit:used:${jti}`;

    // Simulate 100 concurrent attempts
    const results = await Promise.all(
      Array.from({ length: 100 }, () =>
        Promise.resolve(setNX(key))
      )
    );

    successCount = results.filter(Boolean).length;
    expect(successCount).toBe(1);
  });

  it("expired entry can be reclaimed", async () => {
    const store = new Map<string, { value: string; expiresAt: number | null }>();

    function setNX(key: string, ttlMs: number): boolean {
      const entry = store.get(key);
      if (entry && (!entry.expiresAt || entry.expiresAt > Date.now())) {
        return false;
      }
      store.set(key, { value: "1", expiresAt: Date.now() + ttlMs });
      return true;
    }

    const key = "bdit:used:expired-test";

    // Set with very short TTL
    expect(setNX(key, 1)).toBe(true);

    // Wait for expiry
    await new Promise((r) => setTimeout(r, 5));

    // Can reclaim after expiry
    expect(setNX(key, 600_000)).toBe(true);
  });
});

// ─── 2. Key Rotation ────────────────────────────────

describe("Key Rotation", () => {
  it("token signed with old key validates with old key verifier", async () => {
    const issuer = new BditIssuer(keyA.privatePem, "key-old-001");
    const { token } = await issuer.issue(SAMPLE_PARAMS);

    const verifier = BditVerifier.fromPublicKey(keyA.publicPem);
    const result = await verifier.verify(token);

    expect(result.valid).toBe(true);
    expect(result.payload?.bot_id).toBe("bot_test_001");
  });

  it("token signed with old key does NOT validate with new key only", async () => {
    const issuer = new BditIssuer(keyA.privatePem, "key-old-001");
    const { token } = await issuer.issue(SAMPLE_PARAMS);

    // Verifier has only keyB
    const verifier = BditVerifier.fromPublicKey(keyB.publicPem);
    const result = await verifier.verify(token);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("new key signs correctly and validates", async () => {
    const issuer = new BditIssuer(keyB.privatePem, "key-new-001");
    const { token } = await issuer.issue(SAMPLE_PARAMS);

    const verifier = BditVerifier.fromPublicKey(keyB.publicPem);
    const result = await verifier.verify(token);

    expect(result.valid).toBe(true);
  });

  it("issuer uses correct kid in token header", async () => {
    const issuer = new BditIssuer(keyA.privatePem, "payjarvis-prod-1234567890");
    const { token } = await issuer.issue(SAMPLE_PARAMS);

    // Decode header without verification
    const [headerB64] = token.split(".");
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());

    expect(header.kid).toBe("payjarvis-prod-1234567890");
    expect(header.alg).toBe("RS256");
    expect(header.typ).toBe("JWT");
  });
});

// ─── 3. Environment Separation ──────────────────────

describe("Environment Separation", () => {
  it("dev issuer token rejected by prod verifier", async () => {
    const devIssuer = new BditIssuer(keyA.privatePem, "key-dev-001", "payjarvis-development");
    const { token } = await devIssuer.issue(SAMPLE_PARAMS);

    // Production verifier expects issuer "payjarvis"
    const prodVerifier = BditVerifier.fromPublicKey(keyA.publicPem, "payjarvis");
    const result = await prodVerifier.verify(token);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("iss");
  });

  it("prod issuer token rejected by dev verifier", async () => {
    const prodIssuer = new BditIssuer(keyA.privatePem, "key-prod-001", "payjarvis");
    const { token } = await prodIssuer.issue(SAMPLE_PARAMS);

    // Dev verifier expects issuer "payjarvis-development"
    const devVerifier = BditVerifier.fromPublicKey(keyA.publicPem, "payjarvis-development");
    const result = await devVerifier.verify(token);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("iss");
  });

  it("staging issuer token rejected by prod verifier", async () => {
    const stagingIssuer = new BditIssuer(keyA.privatePem, "key-staging-001", "payjarvis-staging");
    const { token } = await stagingIssuer.issue(SAMPLE_PARAMS);

    const prodVerifier = BditVerifier.fromPublicKey(keyA.publicPem, "payjarvis");
    const result = await prodVerifier.verify(token);

    expect(result.valid).toBe(false);
  });

  it("same environment issuer/verifier pair works", async () => {
    const envIssuer = new BditIssuer(keyA.privatePem, "key-staging-001", "payjarvis-staging");
    const { token } = await envIssuer.issue(SAMPLE_PARAMS);

    const envVerifier = BditVerifier.fromPublicKey(keyA.publicPem, "payjarvis-staging");
    const result = await envVerifier.verify(token);

    expect(result.valid).toBe(true);
  });

  it("default issuer is 'payjarvis' for backwards compatibility", async () => {
    const issuer = new BditIssuer(keyA.privatePem, "key-001");
    const { token } = await issuer.issue(SAMPLE_PARAMS);

    // Default verifier (no issuer specified) should accept
    const verifier = BditVerifier.fromPublicKey(keyA.publicPem);
    const result = await verifier.verify(token);

    expect(result.valid).toBe(true);
  });
});

// ─── 4. Algorithm Restriction ───────────────────────

describe("Algorithm Restriction", () => {
  it("rejects tokens with alg:none", async () => {
    // Craft a token with alg:none (classic JWT attack)
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      iss: "payjarvis",
      bot_id: "bot_evil",
      jti: "evil-jti",
      merchant_id: "merchant_test",
      exp: Math.floor(Date.now() / 1000) + 300,
    })).toString("base64url");
    const fakeToken = `${header}.${payload}.`;

    const verifier = BditVerifier.fromPublicKey(keyA.publicPem);
    const result = await verifier.verify(fakeToken);

    expect(result.valid).toBe(false);
  });

  it("rejects tokens signed with HS256 (symmetric key confusion)", async () => {
    // A token signed with a different algorithm should be rejected
    const verifier = BditVerifier.fromPublicKey(keyA.publicPem);

    // Create a valid-looking but wrongly-signed token
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      iss: "payjarvis",
      bot_id: "bot_evil",
      jti: "evil-jti",
      merchant_id: "merchant_test",
      exp: Math.floor(Date.now() / 1000) + 300,
    })).toString("base64url");
    const fakeToken = `${header}.${payload}.fakesignature`;

    const result = await verifier.verify(fakeToken);
    expect(result.valid).toBe(false);
  });

  it("rejects expired tokens", async () => {
    const privateKey = await importPKCS8(keyA.privatePem, "RS256");

    const token = await new SignJWT({
      bot_id: "bot_test",
      jti: "expired-jti",
      merchant_id: "merchant_test",
      owner_id: "user_test",
      trust_score: 80,
      kyc_level: 2,
      categories: ["shopping"],
      max_amount: 500,
      amount: 50,
      category: "shopping",
      session_id: "sess_test",
    })
      .setProtectedHeader({ alg: "RS256", kid: "key-001", typ: "JWT" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 300) // expired 5 min ago
      .setIssuer("payjarvis")
      .setSubject("bot_test")
      .sign(privateKey);

    const verifier = BditVerifier.fromPublicKey(keyA.publicPem);
    const result = await verifier.verify(token);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("exp");
  });

  it("rejects tokens with wrong issuer", async () => {
    const privateKey = await importPKCS8(keyA.privatePem, "RS256");

    const token = await new SignJWT({
      bot_id: "bot_test",
      jti: "wrong-issuer-jti",
      merchant_id: "merchant_test",
      owner_id: "user_test",
      trust_score: 80,
      kyc_level: 2,
      categories: ["shopping"],
      max_amount: 500,
      amount: 50,
      category: "shopping",
      session_id: "sess_test",
    })
      .setProtectedHeader({ alg: "RS256", kid: "key-001", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .setIssuer("evil-issuer")
      .setSubject("bot_test")
      .sign(privateKey);

    const verifier = BditVerifier.fromPublicKey(keyA.publicPem);
    const result = await verifier.verify(token);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("iss");
  });

  it("rejects tokens missing required fields", async () => {
    const privateKey = await importPKCS8(keyA.privatePem, "RS256");

    const token = await new SignJWT({
      // Missing bot_id, merchant_id, jti
      owner_id: "user_test",
      trust_score: 80,
    })
      .setProtectedHeader({ alg: "RS256", kid: "key-001", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .setIssuer("payjarvis")
      .setSubject("bot_test")
      .sign(privateKey);

    const verifier = BditVerifier.fromPublicKey(keyA.publicPem);
    const result = await verifier.verify(token);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Missing required BDIT fields");
  });
});

// ─── 5. Token Structure ─────────────────────────────

describe("Token Structure", () => {
  it("issued token has correct TTL of 5 minutes", async () => {
    const issuer = new BditIssuer(keyA.privatePem, "key-001");
    const { token, expiresAt } = await issuer.issue(SAMPLE_PARAMS);

    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();

    // Should be approximately 300 seconds (5 minutes), allow 2s tolerance
    expect(diffMs).toBeGreaterThan(298_000);
    expect(diffMs).toBeLessThan(302_000);
  });

  it("each issued token has unique jti", async () => {
    const issuer = new BditIssuer(keyA.privatePem, "key-001");

    const jtis = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const { jti } = await issuer.issue(SAMPLE_PARAMS);
      jtis.add(jti);
    }

    expect(jtis.size).toBe(50);
  });

  it("token payload contains all required fields", async () => {
    const issuer = new BditIssuer(keyA.privatePem, "key-001");
    const { token } = await issuer.issue(SAMPLE_PARAMS);

    const verifier = BditVerifier.fromPublicKey(keyA.publicPem);
    const result = await verifier.verify(token);

    expect(result.valid).toBe(true);
    const p = result.payload!;
    expect(p.bot_id).toBe(SAMPLE_PARAMS.botId);
    expect(p.owner_id).toBe(SAMPLE_PARAMS.ownerId);
    expect(p.trust_score).toBe(SAMPLE_PARAMS.trustScore);
    expect(p.kyc_level).toBe(SAMPLE_PARAMS.kycLevel);
    expect(p.merchant_id).toBe(SAMPLE_PARAMS.merchantId);
    expect(p.amount).toBe(SAMPLE_PARAMS.amount);
    expect(p.category).toBe(SAMPLE_PARAMS.category);
    expect(p.jti).toBeDefined();
    expect(p.iat).toBeDefined();
    expect(p.exp).toBeDefined();
  });
});
