/**
 * PAYJARVIS — Onboarding Routes
 *
 * Helps developers identify their platform and find the correct
 * integration guide without manual navigation.
 *
 * GET  /v1/onboarding/guides          — list all available guides
 * POST /v1/onboarding/detect-platform — detect platform from userAgent / code snippet
 */

import type { FastifyInstance } from "fastify";
import { prisma } from "@payjarvis/database";
import { requireAuth, getKycLevel, getInitialTrustScore } from "../middleware/auth.js";
import { createAuditLog } from "../services/audit.js";
import { createAgent } from "../services/agent-identity.js";
import { createHash, randomBytes } from "node:crypto";

// ─────────────────────────────────────────
// PLATFORM DEFINITIONS
// ─────────────────────────────────────────

type Platform =
  | "telegram"
  | "whatsapp"
  | "langchain"
  | "openai-agents"
  | "crewai"
  | "n8n"
  | "flowise"
  | "custom";

type Confidence = "high" | "medium" | "low";

interface PlatformGuide {
  platform: Platform;
  title: string;
  estimatedMinutes: number;
  docsUrl: string;
  description: string;
}

const GUIDES: PlatformGuide[] = [
  {
    platform: "telegram",
    title: "Add PayJarvis to your Telegram bot",
    estimatedMinutes: 5,
    docsUrl: "https://docs.payjarvis.com/integrations/telegram",
    description: "Supports Telegraf and node-telegram-bot-api. Inject tool + system prompt.",
  },
  {
    platform: "whatsapp",
    title: "Add PayJarvis to your WhatsApp bot",
    estimatedMinutes: 7,
    docsUrl: "https://docs.payjarvis.com/integrations/whatsapp",
    description: "Supports Evolution API webhooks and Baileys direct integration.",
  },
  {
    platform: "langchain",
    title: "Add PayJarvis to your LangChain agent",
    estimatedMinutes: 3,
    docsUrl: "https://docs.payjarvis.com/integrations/langchain",
    description: "DynamicStructuredTool ready to add to any LangChain agent.",
  },
  {
    platform: "openai-agents",
    title: "Add PayJarvis to your OpenAI Agents",
    estimatedMinutes: 3,
    docsUrl: "https://docs.payjarvis.com/integrations/openai-agents",
    description: "Native tool for openai.chat.completions.create() with tool_choice.",
  },
  {
    platform: "crewai",
    title: "Add PayJarvis to your CrewAI agent",
    estimatedMinutes: 4,
    docsUrl: "https://docs.payjarvis.com/integrations/crewai",
    description: "BaseTool subclass compatible with any CrewAI crew.",
  },
  {
    platform: "n8n",
    title: "Add PayJarvis to your n8n workflow",
    estimatedMinutes: 5,
    docsUrl: "https://docs.payjarvis.com/integrations/n8n",
    description: "Community node. Install via npm and use in any workflow.",
  },
  {
    platform: "flowise",
    title: "Add PayJarvis to your Flowise chatflow",
    estimatedMinutes: 3,
    docsUrl: "https://docs.payjarvis.com/integrations/flowise",
    description: "Custom tool node for Flowise. Drag into any chatflow.",
  },
  {
    platform: "custom",
    title: "Add PayJarvis to a custom bot",
    estimatedMinutes: 10,
    docsUrl: "https://docs.payjarvis.com/integrations/existing-bot",
    description: "Framework-agnostic guide: system prompt injection + HTTP tool call.",
  },
];

// ─────────────────────────────────────────
// DETECTION RULES — pure string matching
// ─────────────────────────────────────────

interface DetectionRule {
  platform: Platform;
  confidence: Confidence;
  keywords: string[];
  source: "userAgent" | "codeSnippet" | "both";
}

const DETECTION_RULES: DetectionRule[] = [
  { platform: "telegram",       confidence: "high",   keywords: ["telegraf", "node-telegram-bot-api", "telegrambot"], source: "both" },
  { platform: "whatsapp",       confidence: "high",   keywords: ["baileys", "evolution-api", "@evolution", "whatsapp-web", "wweb.js"], source: "both" },
  { platform: "langchain",      confidence: "high",   keywords: ["langchain", "dynamicstructuredtool", "agentexecutor"], source: "both" },
  { platform: "openai-agents",  confidence: "high",   keywords: ["openai.chat.completions", "tool_choice", "openai/resources"], source: "both" },
  { platform: "crewai",         confidence: "high",   keywords: ["crewai", "crew-ai", "basetool", "from crewai"], source: "both" },
  { platform: "n8n",            confidence: "high",   keywords: ["n8n", "n8n-nodes", "inodefunctions"], source: "both" },
  { platform: "flowise",        confidence: "high",   keywords: ["flowise", "flowise-components"], source: "both" },
  { platform: "telegram",       confidence: "medium", keywords: ["bot.on(", "ctx.reply", "ctx.telegram", "telegram"], source: "codeSnippet" },
  { platform: "whatsapp",       confidence: "medium", keywords: ["remotejid", "messages.upsert", "whatsapp", "wpp"], source: "codeSnippet" },
  { platform: "openai-agents",  confidence: "medium", keywords: ["openai", "gpt-4", "tool_calls", "function_call"], source: "codeSnippet" },
];

function detectPlatform(
  userAgent: string,
  codeSnippet?: string
): { platform: Platform; confidence: Confidence } {
  const ua = userAgent.toLowerCase();
  const code = (codeSnippet ?? "").toLowerCase();

  for (const rule of DETECTION_RULES) {
    const searchIn =
      rule.source === "userAgent" ? ua
      : rule.source === "codeSnippet" ? code
      : `${ua} ${code}`;

    if (rule.keywords.some((kw) => searchIn.includes(kw))) {
      return { platform: rule.platform, confidence: rule.confidence };
    }
  }

  return { platform: "custom", confidence: "low" };
}

function getNextStep(platform: Platform): string {
  const steps: Record<Platform, string> = {
    telegram:        "npm install @payjarvis/agent-sdk — then import from @payjarvis/agent-sdk/integrations/telegram",
    whatsapp:        "npm install @payjarvis/agent-sdk — then import from @payjarvis/agent-sdk/integrations/whatsapp",
    langchain:       "npm install @payjarvis/agent-sdk — then use PAYJARVIS_TOOL_SCHEMA with your LangChain agent",
    "openai-agents": "npm install @payjarvis/agent-sdk — then add PAYJARVIS_TOOL_SCHEMA to your tools array",
    crewai:          "pip install payjarvis — then import PayJarvisTool from payjarvis.crewai",
    n8n:             "npm install @payjarvis/n8n-node in your n8n custom nodes directory, then restart n8n",
    flowise:         "Add the PayJarvis Tool node to your Flowise chatflow from the Tools panel",
    custom:          "npm install @payjarvis/agent-sdk — then inject PAYJARVIS_SYSTEM_PROMPT and register PAYJARVIS_TOOL_SCHEMA in your LLM call",
  };
  return steps[platform];
}

// ─────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────

export async function onboardingRoutes(app: FastifyInstance) {

  app.get("/v1/onboarding/guides", async (_req, reply) => {
    return reply.send({ success: true, data: GUIDES });
  });

  app.post("/v1/onboarding/detect-platform", async (request, reply) => {
    const body = request.body as {
      userAgent?: string;
      codeSnippet?: string;
    };

    if (!body?.userAgent && !body?.codeSnippet) {
      return reply.status(400).send({
        success: false,
        error: "Provide at least one of: userAgent, codeSnippet",
      });
    }

    const { platform, confidence } = detectPlatform(
      body.userAgent ?? "",
      body.codeSnippet
    );

    const guide = GUIDES.find((g) => g.platform === platform)!;

    return reply.send({
      success: true,
      data: {
        platform,
        confidence,
        guide: guide.docsUrl,
        estimatedMinutes: guide.estimatedMinutes,
        nextStep: getNextStep(platform),
      },
    });
  });

  // ─────────────────────────────────────────
  // USER ONBOARDING FLOW
  // ─────────────────────────────────────────

  // GET /onboarding/status — current onboarding state
  app.get("/onboarding/status", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      request.log.warn({ clerkId: userId }, "[ONBOARDING] User not found for status check");
      return reply.status(404).send({ success: false, error: "User not found" });
    }

    request.log.info({ clerkId: userId, step: user.onboardingStep, status: user.status, kycLevel: user.kycLevel }, "[ONBOARDING] Status check");
    return { success: true, data: { onboardingStep: user.onboardingStep, status: user.status, kycLevel: user.kycLevel } };
  });

  // POST /onboarding/ocr — Extract document data via Claude Vision
  app.post("/onboarding/ocr", { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as { image: string; mimeType?: string };
    const userId = (request as any).userId as string;

    request.log.info({ userId, mimeType: body?.mimeType, imageLength: body?.image?.length }, "[OCR] Request received");

    if (!body?.image) {
      request.log.warn({ userId }, "[OCR] No image provided");
      return reply.status(400).send({ success: false, error: "image (base64) is required" });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      request.log.error("[OCR] ANTHROPIC_API_KEY not configured");
      return reply.status(503).send({ success: false, error: "OCR service not configured" });
    }

    try {
      request.log.info({ userId, model: "claude-sonnet-4-20250514", imageSize: body.image.length }, "[OCR] Calling Claude Vision API");
      const startTime = Date.now();

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: body.mimeType || "image/jpeg", data: body.image },
              },
              {
                type: "text",
                text: `You are a document OCR extractor. Extract the following fields from this ID document image and return ONLY a valid JSON object with these exact keys:
{"fullName": "full name as printed on document or null", "dateOfBirth": "date in YYYY-MM-DD format or null", "documentNumber": "ID/CPF/passport number or null", "country": "2-letter ISO country code or null"}
Rules: Return ONLY the JSON, no explanation, no markdown fences. If a field is not visible or readable, set it to null. For names, use proper capitalization. For dates, convert any format to YYYY-MM-DD. For country, use ISO 3166-1 alpha-2 (BR, US, PT, etc).`,
              },
            ],
          }],
        }),
      });

      const elapsed = Date.now() - startTime;

      if (!res.ok) {
        const errText = await res.text();
        request.log.error({ status: res.status, body: errText, elapsed }, "[OCR] Claude Vision API error");
        return reply.status(502).send({ success: false, error: "OCR service error" });
      }

      const data = await res.json();
      const rawText = (data as any).content?.[0]?.text || "{}";
      request.log.info({ userId, elapsed, rawResponse: rawText }, "[OCR] Claude Vision raw response");

      const text = rawText.replace(/```json|```/g, "").trim();
      const extracted = JSON.parse(text);

      const filledFields = Object.entries(extracted).filter(([, v]) => v !== null).map(([k]) => k);
      const missedFields = Object.entries(extracted).filter(([, v]) => v === null).map(([k]) => k);
      request.log.info({ userId, elapsed, filled: filledFields, missed: missedFields, extracted }, "[OCR] Extraction result");

      return { success: true, data: extracted };
    } catch (err) {
      request.log.error(err, "[OCR] Processing failed");
      return reply.status(500).send({ success: false, error: "OCR processing failed" });
    }
  });

  // POST /onboarding/step/1 — KYC identity verification
  app.post("/onboarding/step/1", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const body = request.body as {
      fullName: string;
      dateOfBirth: string;
      documentNumber: string;
      country: string;
      address: { street?: string; number?: string; city?: string; state?: string; zip?: string; country?: string };
    };

    request.log.info({ clerkId: userId, fullName: body.fullName, dateOfBirth: body.dateOfBirth, country: body.country, hasDoc: !!body.documentNumber }, "[STEP1] KYC submission received");

    if (!body.fullName || !body.dateOfBirth || !body.documentNumber || !body.country) {
      request.log.warn({ clerkId: userId }, "[STEP1] Missing required fields");
      return reply.status(400).send({ success: false, error: "fullName, dateOfBirth, documentNumber and country are required" });
    }

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return reply.status(404).send({ success: false, error: "User not found" });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        fullName: body.fullName,
        dateOfBirth: new Date(body.dateOfBirth),
        documentNumber: body.documentNumber,
        country: body.country,
        address: body.address ?? {},
        kycLevel: "BASIC",
        kycSubmittedAt: new Date(),
        onboardingStep: 1,
      },
    });

    await createAuditLog({
      entityType: "user",
      entityId: user.id,
      action: "user.kyc_submitted",
      actorType: "user",
      actorId: user.id,
      payload: { country: body.country },
      ipAddress: request.ip,
    });

    request.log.info({ clerkId: userId, userId: user.id }, "[STEP1] KYC saved — step 1 complete");
    return { success: true, data: { onboardingStep: 1 } };
  });

  // POST /onboarding/step/2 — Create bot
  app.post("/onboarding/step/2", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const body = request.body as { name: string; description?: string; category?: string; platform: string };

    request.log.info({ clerkId: userId, name: body.name, platform: body.platform }, "[STEP2] Bot creation request");

    if (!body.name || !body.platform) {
      request.log.warn({ clerkId: userId }, "[STEP2] Missing name or platform");
      return reply.status(400).send({ success: false, error: "name and platform are required" });
    }

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return reply.status(404).send({ success: false, error: "User not found" });
    if (user.onboardingStep < 1) {
      request.log.warn({ clerkId: userId, currentStep: user.onboardingStep }, "[STEP2] Step 1 not completed");
      return reply.status(400).send({ success: false, error: "Complete step 1 first" });
    }

    const apiKey = `pj_bot_${randomBytes(32).toString("hex")}`;
    const apiKeyHash = createHash("sha256").update(apiKey).digest("hex");
    const kycLevelNum = getKycLevel(user.kycLevel);
    const initialTrustScore = getInitialTrustScore(kycLevelNum);

    const bot = await prisma.bot.create({
      data: {
        name: body.name,
        platform: body.platform as any,
        ownerId: user.id,
        apiKeyHash,
        trustScore: initialTrustScore,
      },
    });

    // Default policy
    await prisma.policy.create({
      data: {
        botId: bot.id,
        maxPerTransaction: 50,
        maxPerDay: 200,
        maxPerWeek: 500,
        maxPerMonth: 2000,
        autoApproveLimit: 50,
        requireApprovalUp: 200,
        allowedDays: [1, 2, 3, 4, 5],
        allowedHoursStart: 6,
        allowedHoursEnd: 22,
        allowedCategories: [],
        blockedCategories: [],
        merchantWhitelist: [],
        merchantBlacklist: [],
      },
    });

    const agent = await createAgent(bot.id, user.id, body.name, user.kycLevel);

    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingStep: 2 },
    });

    await createAuditLog({
      entityType: "bot",
      entityId: bot.id,
      action: "bot.created",
      actorType: "user",
      actorId: user.id,
      payload: { name: body.name, platform: body.platform, onboarding: true },
      ipAddress: request.ip,
    });

    request.log.info({ clerkId: userId, botId: bot.id, agentId: agent.id, platform: bot.platform }, "[STEP2] Bot + agent created — step 2 complete");
    return reply.status(201).send({
      success: true,
      data: { bot: { id: bot.id, name: bot.name, platform: bot.platform }, apiKey, agentId: agent.id },
    });
  });

  // POST /onboarding/step/3 — Select integrations (providers)
  app.post("/onboarding/step/3", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const body = request.body as {
      skipped?: boolean;
      integrations?: Array<{ provider: string; category: string }>;
    };

    request.log.info({ clerkId: userId, skipped: body.skipped, count: body.integrations?.length ?? 0 }, "[STEP3] Integrations selection");

    const user = await prisma.user.findUnique({ where: { clerkId: userId }, include: { bots: { take: 1 } } });
    if (!user) return reply.status(404).send({ success: false, error: "User not found" });
    if (user.onboardingStep < 2) {
      request.log.warn({ clerkId: userId, currentStep: user.onboardingStep }, "[STEP3] Step 2 not completed");
      return reply.status(400).send({ success: false, error: "Complete step 2 first" });
    }

    // Save selected integrations to the user's first bot
    if (!body.skipped && body.integrations && body.integrations.length > 0 && user.bots.length > 0) {
      const botId = user.bots[0].id;
      for (const item of body.integrations) {
        await prisma.botIntegration.upsert({
          where: { botId_provider: { botId, provider: item.provider } },
          create: {
            botId,
            provider: item.provider,
            category: item.category,
            enabled: true,
          },
          update: {
            enabled: true,
            category: item.category,
          },
        });
      }
      request.log.info({ clerkId: userId, botId, integrations: body.integrations.map(i => i.provider) }, "[STEP3] Integrations saved");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingStep: 3 },
    });

    request.log.info({ clerkId: userId }, "[STEP3] Step 3 complete");
    return { success: true, data: { onboardingStep: 3 } };
  });

  // POST /onboarding/step/4 — Payment method choice
  app.post("/onboarding/step/4", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const body = request.body as { method: "sdk" | "stripe_card" };

    request.log.info({ clerkId: userId, method: body.method }, "[STEP4] Payment method selection");

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return reply.status(404).send({ success: false, error: "User not found" });
    if (user.onboardingStep < 3) {
      request.log.warn({ clerkId: userId, currentStep: user.onboardingStep }, "[STEP4] Step 3 not completed");
      return reply.status(400).send({ success: false, error: "Complete step 3 first" });
    }

    if (body.method === "stripe_card") {
      const pm = await prisma.paymentMethod.findFirst({
        where: { userId: user.id, provider: "STRIPE", status: "CONNECTED" },
      });
      if (!pm) {
        request.log.warn({ clerkId: userId }, "[STEP4] Stripe card not connected");
        return reply.status(400).send({ success: false, error: "No Stripe card connected. Add a card first." });
      }
      request.log.info({ clerkId: userId, paymentMethodId: pm.id }, "[STEP4] Stripe card verified");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingStep: 4 },
    });

    request.log.info({ clerkId: userId }, "[STEP4] Step 4 complete");
    return { success: true, data: { onboardingStep: 4 } };
  });

  // POST /onboarding/step/5 — Accept terms and complete onboarding
  app.post("/onboarding/step/5", { preHandler: [requireAuth] }, async (request, reply) => {
    const userId = (request as any).userId as string;
    request.log.info({ clerkId: userId }, "[STEP5] Accept terms request");

    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return reply.status(404).send({ success: false, error: "User not found" });
    if (user.onboardingStep < 4) {
      request.log.warn({ clerkId: userId, currentStep: user.onboardingStep }, "[STEP5] Step 4 not completed");
      return reply.status(400).send({ success: false, error: "Complete step 4 first" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        onboardingStep: 6,
        status: "ACTIVE",
        kycLevel: "VERIFIED",
        termsAcceptedAt: new Date(),
      },
    });

    // Auto-assign user to an OpenClaw instance
    let instanceAssignment: { instanceName?: string; port?: number; error?: string } = {};
    try {
      const { assignUserToInstance } = await import("../services/instance-manager.js");
      const result = await assignUserToInstance(user.id);
      if (result.success) {
        instanceAssignment = { instanceName: result.instanceName, port: result.port };
        request.log.info({ userId: user.id, instance: result.instanceName }, "[STEP5] User assigned to OpenClaw instance");
      } else {
        instanceAssignment = { error: result.error };
        request.log.warn({ userId: user.id, error: result.error }, "[STEP5] Failed to assign instance");
      }
    } catch (err) {
      request.log.error({ err }, "[STEP5] Instance assignment error");
    }

    await createAuditLog({
      entityType: "user",
      entityId: user.id,
      action: "user.onboarding_completed",
      actorType: "user",
      actorId: user.id,
      payload: { termsAcceptedAt: new Date().toISOString(), instanceAssignment },
      ipAddress: request.ip,
    });

    request.log.info({ clerkId: userId, userId: user.id }, "[STEP5] Onboarding COMPLETED — user is now ACTIVE");
    return { success: true, data: { onboardingStep: 6, status: "ACTIVE", instance: instanceAssignment } };
  });

  // ─────────────────────────────────────────
  // BOT INTEGRATIONS MANAGEMENT (dashboard)
  // ─────────────────────────────────────────

  // GET /api/integrations/available — list all providers with server-side availability
  app.get("/api/integrations/available", { preHandler: [requireAuth] }, async () => {
    const providers = [
      { provider: "amadeus", label: "Amadeus", description: "Flights & Hotels", category: "travel", envKey: "AMADEUS_CLIENT_ID" },
      { provider: "airbnb", label: "Airbnb", description: "Vacation Rentals", category: "travel", envKey: "" },
      { provider: "yelp", label: "Yelp", description: "Restaurant Search", category: "restaurants", envKey: "YELP_API_KEY" },
      { provider: "opentable", label: "OpenTable", description: "Reservations", category: "restaurants", envKey: "OPENTABLE_CLIENT_ID" },
      { provider: "ticketmaster", label: "Ticketmaster", description: "Events & Tickets", category: "events", envKey: "TICKETMASTER_API_KEY" },
      { provider: "stubhub", label: "StubHub", description: "Resale Tickets", category: "events", envKey: "" },
      { provider: "amazon", label: "Amazon", description: "Products", category: "marketplace", envKey: "__always__" },
      { provider: "mercado_livre", label: "Mercado Livre", description: "Products", category: "marketplace", envKey: "" },
      { provider: "uber", label: "Uber", description: "Rides", category: "transport", envKey: "UBER_CLIENT_ID" },
      { provider: "lyft", label: "Lyft", description: "Rides", category: "transport", envKey: "" },
      { provider: "uber_eats", label: "Uber Eats", description: "Food Delivery", category: "delivery", envKey: "" },
      { provider: "doordash", label: "DoorDash", description: "Food Delivery", category: "delivery", envKey: "" },
    ];

    const data = providers.map((p) => ({
      provider: p.provider,
      label: p.label,
      description: p.description,
      category: p.category,
      available: p.envKey === "__always__" ? true : p.envKey ? !!process.env[p.envKey] : false,
    }));

    return { success: true, data };
  });

  // GET /bots/:botId/integrations — list integrations for a bot
  app.get("/bots/:botId/integrations", { preHandler: [requireAuth] }, async (request, reply) => {
    const { botId } = request.params as { botId: string };
    const userId = (request as any).userId as string;

    const bot = await prisma.bot.findFirst({ where: { id: botId, owner: { clerkId: userId } } });
    if (!bot) return reply.status(404).send({ success: false, error: "Bot not found" });

    const integrations = await prisma.botIntegration.findMany({ where: { botId } });
    return { success: true, data: integrations };
  });

  // POST /bots/:botId/integrations/toggle — toggle a single provider
  app.post("/bots/:botId/integrations/toggle", { preHandler: [requireAuth] }, async (request, reply) => {
    const { botId } = request.params as { botId: string };
    const userId = (request as any).userId as string;
    const body = request.body as { provider: string; category: string; enabled: boolean };

    if (!body.provider) {
      return reply.status(400).send({ success: false, error: "provider is required" });
    }

    const bot = await prisma.bot.findFirst({ where: { id: botId, owner: { clerkId: userId } } });
    if (!bot) return reply.status(404).send({ success: false, error: "Bot not found" });

    const integration = await prisma.botIntegration.upsert({
      where: { botId_provider: { botId, provider: body.provider } },
      create: {
        botId,
        provider: body.provider,
        category: body.category || "other",
        enabled: body.enabled,
        connectedAt: body.enabled ? new Date() : null,
      },
      update: {
        enabled: body.enabled,
        connectedAt: body.enabled ? new Date() : null,
      },
    });

    return { success: true, data: integration };
  });

  // PUT /bots/:botId/integrations — bulk update integrations
  app.put("/bots/:botId/integrations", { preHandler: [requireAuth] }, async (request, reply) => {
    const { botId } = request.params as { botId: string };
    const userId = (request as any).userId as string;
    const body = request.body as { integrations: Array<{ provider: string; category: string; enabled: boolean }> };

    const bot = await prisma.bot.findFirst({ where: { id: botId, owner: { clerkId: userId } } });
    if (!bot) return reply.status(404).send({ success: false, error: "Bot not found" });

    for (const item of body.integrations) {
      await prisma.botIntegration.upsert({
        where: { botId_provider: { botId, provider: item.provider } },
        create: { botId, provider: item.provider, category: item.category, enabled: item.enabled },
        update: { enabled: item.enabled, category: item.category },
      });
    }

    const integrations = await prisma.botIntegration.findMany({ where: { botId } });
    return { success: true, data: integrations };
  });
}
