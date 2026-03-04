import type { PayJarvisConfig, ApprovalRequest, ApprovalDecision, SpendingLimits } from "./types.js";

export class PayJarvis {
  private apiKey: string;
  private botId: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: PayJarvisConfig) {
    this.apiKey = config.apiKey;
    this.botId = config.botId;
    this.baseUrl = (config.baseUrl ?? "https://api.payjarvis.com").replace(/\/$/, "");
    this.timeout = config.timeout ?? 30_000;
  }

  async requestApproval(req: ApprovalRequest): Promise<ApprovalDecision> {
    const merchantId = req.merchantId ?? req.merchant.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const sessionId = crypto.randomUUID();

    const body = {
      merchantName: req.merchant,
      merchantId,
      amount: req.amount,
      category: req.category,
      currency: req.currency ?? "USD",
      description: req.description,
      sessionId,
    };

    const res = await this.fetch(`/bots/${this.botId}/request-payment`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    const json = await res.json() as { success: boolean; data: Record<string, unknown>; error?: string };

    if (!json.success) {
      return {
        approved: false,
        pending: false,
        blocked: true,
        transactionId: "",
        reason: json.error ?? "Request failed",
      };
    }

    const data = json.data;
    const decision = data.decision as string;

    return {
      approved: decision === "APPROVED",
      pending: decision === "PENDING_HUMAN",
      blocked: decision === "BLOCKED",
      transactionId: data.transactionId as string,
      approvalId: data.approvalId as string | undefined,
      bditToken: data.bditToken as string | undefined,
      reason: data.reason as string | undefined,
      expiresAt: data.expiresAt as string | undefined,
    };
  }

  async waitForApproval(
    approvalId: string,
    opts?: { pollInterval?: number; timeout?: number }
  ): Promise<ApprovalDecision> {
    const interval = opts?.pollInterval ?? 2_000;
    const maxWait = opts?.timeout ?? 5 * 60_000;
    const deadline = Date.now() + maxWait;

    while (Date.now() < deadline) {
      const res = await this.fetch(`/approvals/${approvalId}/status`, { method: "GET" });
      const json = await res.json() as { success: boolean; data: Record<string, unknown>; error?: string };

      if (!json.success) {
        throw new Error(json.error ?? "Failed to check approval status");
      }

      const status = json.data.status as string;

      if (status === "APPROVED") {
        return {
          approved: true,
          pending: false,
          blocked: false,
          transactionId: json.data.transactionId as string,
          approvalId,
          bditToken: json.data.bditToken as string | undefined,
          expiresAt: json.data.expiresAt as string | undefined,
        };
      }

      if (status === "REJECTED" || status === "EXPIRED") {
        return {
          approved: false,
          pending: false,
          blocked: true,
          transactionId: json.data.transactionId as string,
          approvalId,
          reason: status === "EXPIRED" ? "Approval expired" : "Rejected by owner",
        };
      }

      // Still PENDING — wait and poll again
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    return {
      approved: false,
      pending: false,
      blocked: true,
      transactionId: "",
      approvalId,
      reason: "Polling timeout exceeded",
    };
  }

  async checkLimits(): Promise<SpendingLimits> {
    const res = await this.fetch(`/bots/${this.botId}/limits/sdk`, { method: "GET" });
    const json = await res.json() as { success: boolean; data: SpendingLimits; error?: string };

    if (!json.success) {
      throw new Error(json.error ?? "Failed to check limits");
    }

    return json.data;
  }

  private async fetch(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await globalThis.fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Bot-Api-Key": this.apiKey,
          ...init.headers,
        },
      });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }
}
