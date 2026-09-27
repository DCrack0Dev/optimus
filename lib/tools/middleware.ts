import type { NextRequest } from "next/server";
import {
  triggerEmergencyStop,
  getSystemMode,
  type EmergencyStopResult,
  type ModeChangeResult
} from "@optimus/lib/security/modes";
import { incrementAndCheck, type IncrementResult } from "@optimus/lib/budgets/engine";
import { writeAudit } from "@optimus/lib/audit/writer";
import type { AuditLogId, BudgetChannel, LeadId, Uid, UserRole } from "@shared/types";
import { isAdminConfigured, getAdminDb } from "@optimus/lib/firebase/admin";

export type OutboundOrigin = "DASHBOARD" | "AI" | "CAMPAIGN" | "FOLLOWUP" | "PUBLIC_BOOKING";

export type ToolMiddlewareInput = {
  actor: { uid: Uid | "AI" | "CUSTOMER" | "SYSTEM" | null; role?: UserRole | null };
  origin: OutboundOrigin;
  channel: "AI" | "EMAIL" | "VOICE" | "WHATSAPP";
  outbound: boolean;
  estimatedDollars?: number;
  estimatedMinutes?: number;
  estimatedMessages?: number;
  estimatedTokens?: number;
  leadId?: LeadId | string | null;
  tool: string;
  req?: Pick<NextRequest, "headers" | "ip"> | null;
  recipientEmail?: string | null;
  recipientPhoneE164?: string | null;
  context?: string | null;
  skipSuppressionCheck?: boolean;
  permission?: "ANY_AUTH" | "ADMIN_ONLY" | "SYSTEM_OR_ADMIN" | "PUBLIC" | "CUSTOMER_AUTH";
};

export type ToolMiddlewareResult = {
  ok: true;
  allowed: true;
  auditRef: AuditLogId | null;
  budgetChecks: Array<{ channel: BudgetChannel; result: IncrementResult }>;
} | {
  ok: true;
  allowed: false;
  denyReason: string;
  denyCode: string;
  auditRef: AuditLogId | null;
  budgetChecks: Array<{ channel: BudgetChannel; result: IncrementResult }>;
} | {
  ok: false;
  allowed: false;
  error: string;
};

async function suppressionCheck(
  channel: "EMAIL" | "WHATSAPP" | "VOICE",
  email: string | null | undefined,
  phone: string | null | undefined
): Promise<{ suppressed: boolean; reason?: string }> {
  if (!isAdminConfigured()) return { suppressed: false };
  if (!email && !phone) return { suppressed: false };
  try {
    const db = getAdminDb();
    const col = db.collection("suppressions");
    const queries: FirebaseFirestore.Query<FirebaseFirestore.DocumentData>[] = [];
    if (email) {
      queries.push(
        col
          .where("email", "==", email.toLowerCase())
          .where("channel", "in", ["ALL", channel] as unknown as string[])
          .limit(1)
      );
    }
    if (phone) {
      queries.push(
        col
          .where("phoneE164", "==", phone)
          .where("channel", "in", ["ALL", channel] as unknown as string[])
          .limit(1)
      );
    }
    for (const q of queries) {
      const s = await q.get();
      if (!s.empty) {
        const d = s.docs[0]?.data() as { reason?: string } | undefined;
        return { suppressed: true, reason: d?.reason ?? "suppressed" };
      }
    }
    return { suppressed: false };
  } catch {
    return { suppressed: false };
  }
}

function rateLimitCheck(_input: ToolMiddlewareInput): { ok: boolean; denyCode?: string } {
  // For now, no global server rate limit state in task 4 (rate limiter in separate file). Delegate to per-route.
  return { ok: true };
}

export async function toolMiddleware(input: ToolMiddlewareInput): Promise<ToolMiddlewareResult> {
  const budgetChecks: Array<{ channel: BudgetChannel; result: IncrementResult }> = [];
  const mode = await getSystemMode();

  if (mode.emergencyStop && input.outbound) {
    const { refId } = await writeAudit({
      actorUid: input.actor.uid,
      event: "AI_TOOL_CALL",
      detail: `deny: emergency_stop tool=${input.tool}`,
      leadId: input.leadId ?? null,
      req: input.req ?? null,
      data: { tool: input.tool, origin: input.origin, channel: input.channel, denyCode: "emergency_stop" }
    });
    return {
      ok: true,
      allowed: false,
      denyReason: "All outbound communications paused (emergency stop).",
      denyCode: "emergency_stop",
      auditRef: refId,
      budgetChecks
    };
  }

  if (input.permission) {
    const role = input.actor.role;
    const isAdmin = role === "admin";
    const isSystem = input.actor.uid === "SYSTEM";
    const isAi = input.actor.uid === "AI";
    const isCustomer = input.actor.uid === "CUSTOMER";
    const anyAuth =
      role === "admin" || role === "client" || role === "staff" || role === "agent" || isAi;
    if (input.permission === "ADMIN_ONLY" && !isAdmin) {
      return {
        ok: true,
        allowed: false,
        denyReason: "Admin required.",
        denyCode: "permission_admin_only",
        auditRef: null,
        budgetChecks
      };
    }
    if (input.permission === "SYSTEM_OR_ADMIN" && !isSystem && !isAdmin) {
      return {
        ok: true,
        allowed: false,
        denyReason: "Admin or system actor required.",
        denyCode: "permission_system_or_admin",
        auditRef: null,
        budgetChecks
      };
    }
    if (input.permission === "ANY_AUTH" && !anyAuth) {
      return {
        ok: true,
        allowed: false,
        denyReason: "Authentication required.",
        denyCode: "permission_any_auth",
        auditRef: null,
        budgetChecks
      };
    }
    if (input.permission === "CUSTOMER_AUTH" && !isCustomer && !anyAuth) {
      return {
        ok: true,
        allowed: false,
        denyReason: "Customer or authenticated actor required.",
        denyCode: "permission_customer_auth",
        auditRef: null,
        budgetChecks
      };
    }
  }

  if (input.channel !== "AI" && input.outbound && !input.skipSuppressionCheck) {
    if (input.channel === "EMAIL" || input.channel === "WHATSAPP" || input.channel === "VOICE") {
      const sup = await suppressionCheck(input.channel, input.recipientEmail, input.recipientPhoneE164);
      if (sup.suppressed) {
        const { refId } = await writeAudit({
          actorUid: input.actor.uid,
          event: "AI_TOOL_CALL",
          detail: `deny: suppressed tool=${input.tool} reason=${sup.reason ?? "unspecified"}`,
          leadId: input.leadId ?? null,
          req: input.req ?? null,
          data: { tool: input.tool, denyCode: "suppressed", suppressionReason: sup.reason ?? null }
        });
        return {
          ok: true,
          allowed: false,
          denyReason: "Recipient is suppressed for this channel.",
          denyCode: "suppressed",
          auditRef: refId,
          budgetChecks
        };
      }
    }
  }

  const rl = rateLimitCheck(input);
  if (!rl.ok) {
    return {
      ok: true,
      allowed: false,
      denyReason: "Rate limit exceeded.",
      denyCode: rl.denyCode ?? "rate_limit",
      auditRef: null,
      budgetChecks
    };
  }

  const dollars = Math.max(0, input.estimatedDollars ?? 0);
  if (dollars > 0) {
    const res = await incrementAndCheck(
      { uid: input.actor.uid, role: input.actor.role ?? null },
      input.channel,
      dollars,
      {
        minutes: input.estimatedMinutes,
        messages: input.estimatedMessages,
        tokens: input.estimatedTokens,
        context: input.context ?? `tool=${input.tool}`,
        leadId: input.leadId ?? null
      }
    );
    budgetChecks.push({ channel: input.channel, result: res });
    if (!res.ok) {
      return { ok: false, allowed: false, error: res.denyReason ?? "budget_error" };
    }
    if (!res.allowed) {
      return {
        ok: true,
        allowed: false,
        denyReason: `Budget limit reached for ${input.channel}.`,
        denyCode: "budget_exceeded",
        auditRef: null,
        budgetChecks
      };
    }
  }

  // Also reserve against TOTAL_OUTREACH if outbound and channel!=AI
  if (input.outbound && input.channel !== "AI" && dollars > 0) {
    const totalRes = await incrementAndCheck(
      { uid: input.actor.uid, role: input.actor.role ?? null },
      "TOTAL_OUTREACH",
      dollars,
      { context: `tool=${input.tool} (total reach)`, leadId: input.leadId ?? null }
    );
    budgetChecks.push({ channel: "TOTAL_OUTREACH", result: totalRes });
    if (!totalRes.ok) {
      return { ok: false, allowed: false, error: totalRes.denyReason ?? "total_budget_error" };
    }
    if (!totalRes.allowed) {
      return {
        ok: true,
        allowed: false,
        denyReason: "Total outreach budget limit reached.",
        denyCode: "total_budget_exceeded",
        auditRef: null,
        budgetChecks
      };
    }
  }

  const { refId } = await writeAudit({
    actorUid: input.actor.uid,
    event: "AI_TOOL_CALL",
    detail: `allow tool=${input.tool}`,
    leadId: input.leadId ?? null,
    req: input.req ?? null,
    data: {
      tool: input.tool,
      origin: input.origin,
      channel: input.channel,
      outbound: input.outbound,
      estimatedDollars: dollars,
      estimatedTokens: input.estimatedTokens ?? null,
      estimatedMinutes: input.estimatedMinutes ?? null,
      estimatedMessages: input.estimatedMessages ?? null,
      budgetChecks: budgetChecks.map((c) => ({
        channel: c.channel,
        allowed: c.result.allowed,
        used: c.result.usedDollars ?? null,
        limit: c.result.limitDollars ?? null
      }))
    }
  });
  return {
    ok: true,
    allowed: true,
    auditRef: refId,
    budgetChecks
  };
}

export { triggerEmergencyStop };
export type { EmergencyStopResult, ModeChangeResult };
