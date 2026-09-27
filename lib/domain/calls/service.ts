import { getAdminDb, isAdminConfigured } from "@optimus/lib/firebase/admin";
import type { CallDoc, CallId, CallOutcome, LeadId, Uid, UserRole, BookingId } from "@shared/types";

interface ListCallsParams {
  leadId?: LeadId;
  outcome?: string;
  direction?: string;
  limit?: number;
  cursor?: string;
}
import { writeAudit } from "@optimus/lib/audit/writer";
import { toolMiddleware } from "@optimus/lib/tools/middleware";

function callId(): CallId {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  ) as CallId;
}

export interface InitiateCallInput {
  actor: { uid: Uid | "AI" | "SYSTEM"; role?: UserRole | null };
  origin: "DASHBOARD" | "AI" | "CAMPAIGN";
  leadId: LeadId | null;
  toE164: string;
  contextPurpose?: string | null;
}

export interface CallProvider {
  name: string;
  initiateCall(call: { toE164: string; fromE164: string; context?: string }): Promise<{ success: boolean; callId?: string; providerCallId?: string; error?: string }>;
  endCall(providerCallId: string, outcome: CallOutcome, durationSeconds?: number): Promise<{ success: boolean; error?: string }>;
  handleInboundWebhook(payload: any): Promise<{ ok: boolean; processed: number; errors: string[] }>;
}

export async function initiateCall(
  input: InitiateCallInput
): Promise<{ ok: true; callId: CallId; providerCallId?: string } | { ok: false; error: string }> {
  const middlewareResult = await toolMiddleware({
    actor: { uid: input.actor.uid, role: input.actor.role ?? null },
    origin: input.origin,
    channel: "VOICE",
    outbound: true,
    estimatedDollars: 0.05,
    estimatedMinutes: 5,
    leadId: input.leadId,
    tool: "initiateCall",
    context: input.contextPurpose ?? "outbound_call",
  });

  if (!middlewareResult.ok) {
    return { ok: false, error: middlewareResult.error ?? "middleware_error" };
  }
  if (!middlewareResult.allowed) {
    return { ok: false, error: middlewareResult.denyReason ?? "denied" };
  }

  if (!isAdminConfigured()) {
    return { ok: false, error: "Firebase Admin not configured" };
  }

  const db = getAdminDb();
  const now = Date.now();

  // Get provider
  const provider = getCallProvider();
  if (!provider) {
    return { ok: false, error: "Voice provider not configured" };
  }

  const fromE164 = process.env.TELNYX_CALLER_ID ?? process.env.TEBOGO_PHONE_E164 ?? "+27100000000";

  const providerResult = await provider.initiateCall({
    toE164: input.toE164,
    fromE164,
    context: input.contextPurpose ?? "Outbound call",
  });

  if (!providerResult.success) {
    return { ok: false, error: providerResult.error ?? "Provider call initiation failed" };
  }

  const id = callId();
  const callDoc: CallDoc = {
    id,
    leadId: input.leadId,
    direction: "OUTBOUND",
    fromE164,
    toE164: input.toE164,
    provider: "telnyx",
    providerCallId: providerResult.providerCallId ?? null,
    status: "QUEUED",
    outcome: null,
    durationSeconds: null,
    answeredAt: null,
    endedAt: null,
    humanHandoff: {
      requested: false,
      triedConference: false,
      tebogoAnswered: false,
      bookedBookingId: null,
      handoffReason: null,
    },
    tebogoJoinedAt: null,
    recordingAssetId: null,
    transcript: [],
    summary: null,
    aiMood: null,
    interested: null,
    service: null,
    budgetRange: null,
    timeline: null,
    recordings: [],
    createdAt: now,
    updatedAt: now,
  };

  await db.collection("calls").doc(id).create(callDoc);

  if (input.leadId) {
    await db.collection("leads").doc(input.leadId).set(
      { status: "CONTACTED", lastContactAt: now, updatedAt: now },
      { merge: true }
    );
  }

  await writeAudit({
    actorUid: input.actor.uid,
    event: "CALL_INITIATE",
    detail: `outbound call to ${input.toE164}`,
    leadId: input.leadId,
    callId: id,
    data: { providerCallId: providerResult.providerCallId, provider: "telnyx" },
  });

  return { ok: true, callId: id, providerCallId: providerResult.providerCallId };
}

export async function handleCallWebhook(
  event: {
    type: string;
    callId: string;
    providerCallId: string;
    timestamp: number;
    data?: Record<string, unknown>;
  }
): Promise<{ ok: boolean; error?: string }> {
  if (!isAdminConfigured()) return { ok: false, error: "Firebase Admin not configured" };

  const db = getAdminDb();
  const ref = db.collection("calls").doc(event.callId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "call_not_found" };

  const callDoc = snap.data() as CallDoc;
  const now = event.timestamp;

  let newStatus = callDoc.status;
  let newOutcome = callDoc.outcome;
  let newAnsweredAt = callDoc.answeredAt;
  let newEndedAt = callDoc.endedAt;
  let newDuration = callDoc.durationSeconds;
  let newHumanHandoff = callDoc.humanHandoff ?? {
    requested: false,
    triedConference: false,
    tebogoAnswered: false,
    bookedBookingId: null as BookingId | null,
    handoffReason: null,
  };

  switch (event.type) {
    case "initiated":
      newStatus = "RINGING";
      break;
    case "answered":
      newStatus = "CONNECTED";
      newOutcome = "ANSWERED";
      newAnsweredAt = now;
      break;
    case "ended":
      newStatus = "ENDED";
      newOutcome = "ANSWERED";
      newEndedAt = now;
      if (callDoc.answeredAt) {
        newDuration = Math.round((now - callDoc.answeredAt) / 1000);
      }
      break;
    case "missed":
      newStatus = "ENDED";
      newOutcome = "MISSED";
      newEndedAt = now;
      break;
    case "failed":
      newStatus = "FAILED";
      newOutcome = "FAILED";
      newEndedAt = now;
      break;
    case "hangup":
      newStatus = "ENDED";
      newOutcome = "ANSWERED";
      newEndedAt = now;
      if (callDoc.answeredAt) {
        newDuration = Math.round((now - callDoc.answeredAt) / 1000);
      }
      break;
    case "handoff_requested":
      newHumanHandoff = {
        requested: true,
        triedConference: callDoc.humanHandoff?.triedConference ?? false,
        tebogoAnswered: callDoc.humanHandoff?.tebogoAnswered ?? false,
        bookedBookingId: callDoc.humanHandoff?.bookedBookingId ?? null,
        handoffReason: event.data?.reason as string ?? "Customer requested human",
      };
      break;
    case "handoff_conference_started":
      newHumanHandoff = {
        requested: newHumanHandoff.requested ?? false,
        triedConference: true,
        tebogoAnswered: newHumanHandoff.tebogoAnswered ?? false,
        bookedBookingId: newHumanHandoff.bookedBookingId ?? null,
        handoffReason: newHumanHandoff.handoffReason ?? null,
      };
      break;
    case "handoff_tebogo_answered":
      newHumanHandoff = {
        requested: newHumanHandoff.requested ?? false,
        triedConference: newHumanHandoff.triedConference ?? false,
        tebogoAnswered: true,
        bookedBookingId: newHumanHandoff.bookedBookingId ?? null,
        handoffReason: newHumanHandoff.handoffReason ?? null,
      };
      newEndedAt = now;
      break;
    case "handoff_booking_created":
      newHumanHandoff = {
        requested: newHumanHandoff.requested ?? false,
        triedConference: newHumanHandoff.triedConference ?? false,
        tebogoAnswered: newHumanHandoff.tebogoAnswered ?? false,
        bookedBookingId: event.data?.bookingId as string ?? null,
        handoffReason: newHumanHandoff.handoffReason ?? null,
      };
      break;
  }

  const updates: Partial<CallDoc> = {
    status: newStatus,
    outcome: newOutcome,
    answeredAt: newAnsweredAt,
    endedAt: newEndedAt,
    durationSeconds: newDuration,
    humanHandoff: newHumanHandoff,
    updatedAt: now,
  };

  // Add tebogoJoinedAt if tebogo answered
  if (event.type === "handoff_tebogo_answered") {
    updates.tebogoJoinedAt = now;
  }

  await ref.update(updates);

  if (callDoc.leadId) {
    await db.collection("leads").doc(callDoc.leadId).set(
      { lastContactAt: now, updatedAt: now },
      { merge: true }
    );
  }

  await writeAudit({
    actorUid: "SYSTEM",
    event: "CALL_END",
    detail: `call ${event.callId} ${event.type}`,
    leadId: callDoc.leadId ?? null,
    callId: event.callId,
    data: { eventType: event.type, outcome: newOutcome, duration: newDuration },
  });

  return { ok: true };
}

function getCallProvider(): CallProvider | null {
  const providerType = process.env.VOICE_PROVIDER?.toLowerCase() ?? "telnyx";
  switch (providerType) {
    case "telnyx":
      return createTelnyxProvider();
    case "twilio":
      return createTwilioProvider();
    default:
      return null;
  }
}

function createTelnyxProvider(): { name: string; initiateCall: (call: { toE164: string; fromE164: string; context?: string }) => Promise<{ success: boolean; callId?: string; providerCallId?: string; error?: string }>; endCall: (providerCallId: string, outcome: string, durationSeconds?: number) => Promise<{ success: boolean; error?: string }>; handleInboundWebhook: (payload: any) => Promise<{ ok: boolean; processed: number; errors: string[] }> } | null {
  const apiKey = process.env.TELNYX_API_KEY;
  const connectionId = process.env.TELNYX_CONNECTION_ID;
  const fromNumber = process.env.TELNYX_CALLER_ID;

  if (!apiKey || !connectionId || !fromNumber) {
    return null;
  }

  const baseUrl = "https://api.telnyx.com/v2";

  return {
    name: "telnyx",
    async initiateCall({ toE164, fromE164, context }) {
      try {
        const response = await fetch(`${baseUrl}/calls`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            connection_id: connectionId,
            from: fromE164 ?? fromNumber,
            to: toE164,
            state: "active",
            media_handling: "full",
            payload: context ?? "outbound_call",
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          return { success: false, error: data.errors?.[0]?.detail ?? `Telnyx error: ${response.status}` };
        }

        return {
          success: true,
          providerCallId: data.data?.id,
        };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    async endCall(providerCallId, _outcome, _durationSeconds) {
      try {
        const response = await fetch(`${baseUrl}/calls/${providerCallId}/actions/hangup`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return { success: response.ok, error: response.ok ? undefined : "Failed to end call" };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    async handleInboundWebhook(_payload) {
      // Telnyx webhook handling would be implemented here
      return { ok: true, processed: 0, errors: [] };
    },
  };
}

function createTwilioProvider(): any {
  return null;
}

export function listCalls(
  params: ListCallsParams
): Promise<{ items: Array<CallDoc & { id: CallId }>; nextCursor: string | null }> {
  return new Promise(async (resolve) => {
    if (!isAdminConfigured()) {
      resolve({ items: [], nextCursor: null });
      return;
    }

    const db = getAdminDb();
    let query: any = db.collection("calls");

    if (params.leadId) query = query.where("leadId", "==", params.leadId);
    if (params.outcome) query = query.where("outcome", "==", params.outcome);
    if (params.direction) query = query.where("direction", "==", params.direction);

    const limit = Math.max(1, Math.min(200, params.limit ?? 50));
    if (params.cursor) {
      try {
        const raw = Buffer.from(params.cursor, "base64url").toString("utf8");
        const parsed = JSON.parse(raw) as { v: number | null };
        const v = parsed.v;
        if (v !== null && typeof v === "number") {
          query = query.where("createdAt", ">", v);
        }
      } catch {
        // ignore bad cursor
      }
    }

    query = query.orderBy("createdAt", "desc").limit(limit + 1);
    const snap = await query.get();
    const docs = snap.docs.slice();
    let nextCursor: string | null = null;
    const items: Array<CallDoc & { id: CallId }> = [];

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i]!;
      if (i >= limit) {
        const data = doc.data() as any;
        const sortValue = data.createdAt ?? null;
        nextCursor = Buffer.from(JSON.stringify({ v: sortValue })).toString("base64url");
        break;
      }
      items.push({ ...(doc.data() as CallDoc), id: doc.id as CallId });
    }

    resolve({ items, nextCursor });
  });
}

export async function getCall(
  callId: CallId
): Promise<(CallDoc & { id: CallId }) | null> {
  if (!isAdminConfigured()) return null;
  const db = getAdminDb();
  const snap = await db.collection("calls").doc(callId).get();
  if (!snap.exists) return null;
  return { ...(snap.data() as CallDoc), id: callId };
}

export async function updateCall(
  _actor: { uid: Uid | "AI" | "SYSTEM"; role?: UserRole | null },
  callId: CallId,
  inputPatch: Partial<CallDoc>
): Promise<CallDoc | null> {
  if (!isAdminConfigured()) return null;
  const db = getAdminDb();
  const ref = db.collection("calls").doc(callId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const existing = snap.data() as CallDoc;
  const mergedPatch = { ...inputPatch, updatedAt: Date.now() };
  await ref.set(mergedPatch, { merge: true });
  const updated: CallDoc = { ...existing, ...mergedPatch };
  return updated;
}