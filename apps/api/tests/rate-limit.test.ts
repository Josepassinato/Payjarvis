/**
 * Rate Limit Tests for /v1/verify
 *
 * Tests that the rate limiter is properly configured and enforces limits.
 * Uses standalone Fastify instances with the rate-limit plugin registered.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";

describe("Rate Limit on /v1/verify", () => {
  let app: FastifyInstance;
  const MAX_REQUESTS = 5;

  beforeAll(async () => {
    app = Fastify();

    await app.register(rateLimit, {
      max: MAX_REQUESTS,
      timeWindow: 60_000,
      keyGenerator: (request) => request.ip,
      errorResponseBuilder: (_request, context) => ({
        statusCode: 429,
        verified: false,
        error: "Rate limit exceeded",
        retryAfter: context.after,
      }),
    });

    app.get("/v1/verify", async (_request, reply) => {
      return reply.send({ verified: false, error: "No token (test stub)" });
    });

    app.post("/v1/verify", async (_request, reply) => {
      return reply.send({ verified: false, error: "No token (test stub)" });
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("allows requests under the limit", async () => {
    for (let i = 0; i < MAX_REQUESTS; i++) {
      const res = await app.inject({
        method: "GET",
        url: "/v1/verify",
        headers: { "x-bdit-token": "test-token" },
      });
      expect(res.statusCode).toBe(200);
    }
  });

  it("returns 429 after exceeding the limit", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/verify",
    });

    expect(res.statusCode).toBe(429);
    const body = JSON.parse(res.body);
    expect(body.verified).toBe(false);
    expect(body.error).toBe("Rate limit exceeded");
    expect(body.retryAfter).toBeDefined();
  });

  it("includes rate limit headers in responses", async () => {
    const freshApp = Fastify();
    await freshApp.register(rateLimit, {
      max: 10,
      timeWindow: 60_000,
      keyGenerator: (request) => request.ip,
    });
    freshApp.get("/v1/verify", async () => ({ ok: true }));
    await freshApp.ready();

    const res = await freshApp.inject({
      method: "GET",
      url: "/v1/verify",
    });

    expect(res.headers["x-ratelimit-limit"]).toBeDefined();
    expect(res.headers["x-ratelimit-remaining"]).toBeDefined();

    await freshApp.close();
  });

  it("rate limits POST /v1/verify equally", async () => {
    const postApp = Fastify();
    await postApp.register(rateLimit, {
      max: 2,
      timeWindow: 60_000,
      keyGenerator: (request) => request.ip,
      errorResponseBuilder: () => ({
        statusCode: 429,
        verified: false,
        error: "Rate limit exceeded",
      }),
    });
    postApp.post("/v1/verify", async () => ({ verified: false }));
    await postApp.ready();

    const r1 = await postApp.inject({ method: "POST", url: "/v1/verify", payload: {} });
    const r2 = await postApp.inject({ method: "POST", url: "/v1/verify", payload: {} });
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);

    const r3 = await postApp.inject({ method: "POST", url: "/v1/verify", payload: {} });
    expect(r3.statusCode).toBe(429);
    expect(JSON.parse(r3.body).error).toBe("Rate limit exceeded");

    await postApp.close();
  });

  it("different IPs have independent limits", async () => {
    const ipApp = Fastify();
    await ipApp.register(rateLimit, {
      max: 1,
      timeWindow: 60_000,
      keyGenerator: (request) => request.headers["x-forwarded-for"] as string ?? request.ip,
    });
    ipApp.get("/v1/verify", async () => ({ ok: true }));
    await ipApp.ready();

    const r1 = await ipApp.inject({
      method: "GET",
      url: "/v1/verify",
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    expect(r1.statusCode).toBe(200);

    const r2 = await ipApp.inject({
      method: "GET",
      url: "/v1/verify",
      headers: { "x-forwarded-for": "5.6.7.8" },
    });
    expect(r2.statusCode).toBe(200);

    // Same IP again should be limited
    const r3 = await ipApp.inject({
      method: "GET",
      url: "/v1/verify",
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    expect(r3.statusCode).toBe(429);

    await ipApp.close();
  });
});
