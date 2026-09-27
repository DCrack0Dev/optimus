import { getAdminDb, isAdminConfigured } from "@optimus/lib/firebase/admin";
import type { Budget, BudgetChannel, Uid, UserRole } from "@shared/types";
import { writeAudit } from "@optimus/lib/audit/writer";

function monthBounds(now = Date.now()): { start: number; end: number } {
  const d = new Date(now);
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).getTime();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
  return { start, end };
}

function dayKey(ts = Date.now()): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

async function getOrCreateBudget(channel: BudgetChannel): Promise<Budget> {
  const defaults: Record<BudgetChannel, number> = {
    AI: 10,
    EMAIL: 0,
    VOICE: 5,
    WHATSAPP: 5,
    TOTAL_OUTREACH: 25
  };
  const envLimit: Record<BudgetChannel, string> = {
    AI: "BUDGET_AI_LIMIT_USD",
    EMAIL: "BUDGET_EMAIL_LIMIT_USD",
    VOICE: "BUDGET_VOICE_LIMIT_USD",
    WHATSAPP: "BUDGET_WHATSAPP_LIMIT_USD",
    TOTAL_OUTREACH: "BUDGET_TOTAL_LIMIT_USD"
  };
  const bounds = monthBounds();
  const docId = `default_${channel}`;
  if (!isAdminConfigured()) {
    const limit = Number(process.env[envLimit[channel]] ?? defaults[channel]);
    return {
      id: docId,
      channel,
      limitDollars: limit,
      usedDollars: 0,
      usedTokens: null,
      usedMinutes: null,
      usedMessages: null,
      stopAtBudget: true,
      periodStart: bounds.start,
      periodEnd: bounds.end,
      updatedAt: Date.now()
    };
  }
  const db = getAdminDb();
  const ref = db.collection("budgets").doc(docId);
  const snap = await ref.get();
  if (snap.exists) {
    const data = snap.data() as Partial<Budget> | undefined;
    const current: Budget = {
      id: docId,
      channel,
      limitDollars: Number(process.env[envLimit[channel]] ?? defaults[channel]),
      usedDollars: 0,
      usedTokens: null,
      usedMinutes: null,
      usedMessages: null,
      stopAtBudget: true,
      periodStart: bounds.start,
      periodEnd: bounds.end,
      updatedAt: Date.now(),
      ...data
    };
    if (current.periodEnd < bounds.start || current.periodStart > bounds.end) {
      current.periodStart = bounds.start;
      current.periodEnd = bounds.end;
      current.usedDollars = 0;
      current.updatedAt = Date.now();
      await ref.set({ ...current, id: docId }, { merge: true });
    }
    return current;
  }
  const limit = Number(process.env[envLimit[channel]] ?? defaults[channel]);
  const created: Budget = {
    id: docId,
    channel,
    limitDollars: limit,
    usedDollars: 0,
    usedTokens: null,
    usedMinutes: null,
    usedMessages: null,
    stopAtBudget: true,
    periodStart: bounds.start,
    periodEnd: bounds.end,
    updatedAt: Date.now()
  };
  await ref.set({ ...created, id: docId });
  return created;
}

export async function getBudget(channel: BudgetChannel): Promise<Budget> {
  return getOrCreateBudget(channel);
}

export type IncrementResult = {
  ok: boolean;
  allowed: boolean;
  denyReason?: string;
  usedDollars?: number;
  limitDollars?: number;
  remainingDollars?: number;
};

export async function incrementAndCheck(
  actor: { uid: Uid | "AI" | "SYSTEM" | null; role?: UserRole | null },
  channel: BudgetChannel,
  dollars: number,
  opts?: {
    minutes?: number;
    messages?: number;
    tokens?: number;
    context?: string;
    leadId?: string | null;
  }
): Promise<IncrementResult> {
  if (dollars < 0 || !Number.isFinite(dollars)) {
    return { ok: false, allowed: false, denyReason: "invalid_amount" };
  }
  const bounds = monthBounds();
  const docId = `default_${channel}`;
  if (!isAdminConfigured()) {
    const base = await getOrCreateBudget(channel);
    const after = Math.min(Number.MAX_SAFE_INTEGER, base.usedDollars + dollars);
    const allowed = !base.stopAtBudget || after <= base.limitDollars;
    if (!allowed) {
      await writeAudit({
        actorUid: actor.uid,
        event: "BUDGET_EXCEEDED",
        detail: opts?.context ?? `budget exceeded channel=${channel}`,
        leadId: opts?.leadId ?? null,
        data: { channel, dollars, used: base.usedDollars, limit: base.limitDollars }
      });
    }
    return {
      ok: true,
      allowed,
      denyReason: allowed ? undefined : "budget_exceeded",
      usedDollars: after,
      limitDollars: base.limitDollars,
      remainingDollars: Math.max(0, base.limitDollars - after)
    };
  }
  const db = getAdminDb();
  const todayKey = dayKey();
  let usedAfter = 0;
  let limit = 0;
  let denyReason: string | undefined;
  const ref = db.collection("budgets").doc(docId);
  try {
    await db.runTransaction(async (txn) => {
      const snap = await txn.get(ref);
      let current: Budget;
      if (!snap.exists) {
        current = await getOrCreateBudget(channel);
      } else {
        const data = snap.data() as Partial<Budget> | undefined;
        const defaultB = await getOrCreateBudget(channel);
        current = { ...defaultB, ...data };
      }
      if (current.periodEnd < bounds.start || current.periodStart > bounds.end) {
        current.periodStart = bounds.start;
        current.periodEnd = bounds.end;
        current.usedDollars = 0;
      }
      limit = current.limitDollars;
      const after = current.usedDollars + dollars;
      usedAfter = after;
      if (current.stopAtBudget && after > current.limitDollars + 0.0001) {
        denyReason = "budget_exceeded";
        txn.set(ref, { ...current, id: docId, updatedAt: Date.now() }, { merge: true });
        return;
      }
      const nextUsedTokens =
        opts?.tokens == null
          ? current.usedTokens
          : (current.usedTokens ?? 0) + opts.tokens;
      const nextUsedMessages =
        opts?.messages == null
          ? current.usedMessages
          : (current.usedMessages ?? 0) + opts.messages;
      const nextUsedMinutes =
        opts?.minutes == null
          ? current.usedMinutes
          : (current.usedMinutes ?? 0) + opts.minutes;
      const patch: Partial<Budget> = {
        usedDollars: after,
        usedTokens: nextUsedTokens,
        usedMessages: nextUsedMessages,
        usedMinutes: nextUsedMinutes,
        updatedAt: Date.now()
      };
      txn.set(ref, { ...current, ...patch, id: docId }, { merge: true });
      const counterRef = db
        .collection("budget_daily_counters")
        .doc(`${channel}_${todayKey}`);
      const csnap = await txn.get(counterRef);
      const baseCounter = csnap.exists
        ? (csnap.data() as { usedDollars?: number; usedMessages?: number; usedMinutes?: number } | undefined) ?? {}
        : { usedDollars: 0, usedMessages: 0, usedMinutes: 0 };
      txn.set(
        counterRef,
        {
          channel,
          dateKey: todayKey,
          usedDollars: (baseCounter.usedDollars ?? 0) + dollars,
          usedMessages: (baseCounter.usedMessages ?? 0) + (opts?.messages ?? 0),
          usedMinutes: (baseCounter.usedMinutes ?? 0) + (opts?.minutes ?? 0)
        },
        { merge: true }
      );
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, allowed: false, denyReason: `transaction_error:${message}` };
  }
  if (denyReason) {
    await writeAudit({
      actorUid: actor.uid,
      event: "BUDGET_EXCEEDED",
      detail: opts?.context ?? `budget exceeded channel=${channel}`,
      leadId: opts?.leadId ?? null,
      data: { channel, dollars, used: usedAfter - dollars, limit }
    });
  }
  return {
    ok: true,
    allowed: !denyReason,
    denyReason,
    usedDollars: usedAfter,
    limitDollars: limit,
    remainingDollars: Math.max(0, limit - usedAfter)
  };
}

export async function setBudgetLimit(
  actor: { uid: Uid; role: UserRole },
  channel: BudgetChannel,
  { limitDollars, stopAtBudget }: { limitDollars?: number; stopAtBudget?: boolean }
): Promise<{ ok: boolean; reason?: string; budget?: Budget }> {
  if (actor.role !== "admin") return { ok: false, reason: "forbidden_admin_only" };
  const current = await getOrCreateBudget(channel);
  const patch: Partial<Budget> = { updatedAt: Date.now() };
  if (typeof limitDollars === "number" && Number.isFinite(limitDollars) && limitDollars >= 0) {
    patch.limitDollars = limitDollars;
  }
  if (typeof stopAtBudget === "boolean") {
    patch.stopAtBudget = stopAtBudget;
  }
  if (isAdminConfigured()) {
    const db = getAdminDb();
    const ref = db.collection("budgets").doc(current.id);
    await ref.set({ ...current, ...patch, id: current.id }, { merge: true });
  }
  const updated: Budget = { ...current, ...patch };
  await writeAudit({
    actorUid: actor.uid,
    event: "SETTINGS_UPDATE",
    detail: `budget update channel=${channel}`,
    data: { channel, limitDollars, stopAtBudget }
  });
  return { ok: true, budget: updated };
}
