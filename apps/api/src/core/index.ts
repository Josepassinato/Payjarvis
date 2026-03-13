// ─── Layer 1: Core modules ───

export { evaluatePolicy } from "./policy-engine.js";
export type { PolicyAction, PolicyDecision } from "./policy-engine.js";

export { getTrustLevel, getAutoApproveLimit, shouldRequireApproval, TrustLevel } from "./trust-manager.js";
export type { TrustLevelType } from "./trust-manager.js";

export { requestApproval, approve, reject, checkTimeouts, startTimeoutChecker, stopTimeoutChecker } from "./approval-manager.js";
export type { ApprovalAction, ApprovalResult } from "./approval-manager.js";

export { createSession, getSession, updateSession, endSession } from "./session-manager.js";
export type { BotSession, PendingAction } from "./session-manager.js";

export { logEvent, AuditEvents } from "./audit-logger.js";
export type { AuditEvent, AuditEventType } from "./audit-logger.js";

export { execute } from "./action-executor.js";
export type { ActionRequest, ActionResult, ActionType } from "./action-executor.js";
