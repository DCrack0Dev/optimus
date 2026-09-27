import { getAdminDb, isAdminConfigured } from "@optimus/lib/firebase/admin";
import type {
  Followup,
  FollowupId,
  FollowupStatus,
  FollowupChannel,
  LeadId,
  Uid,
  UserRole,
  EmailId,
  WhatsAppMessageId,
  CallId,
  CampaignId,
} from "@shared/types";
import { writeAudit } from "@optimus/lib/audit/writer";
import { toolMiddleware } from "@optimus/lib/tools/middleware";

function followupId(): FollowupId {
  return `fu_${Date.now()}_${Math.random().toString(36).slice(2, 10)}` as FollowupId;
}

export interface CreateFollowupInput {
  actor: { uid: Uid | "AI" | "SYSTEM"; role?: UserRole | null };
  origin: "DASHBOARD" | "AI" | "CAMPAIGN";
  leadId: LeadId;
  channel: FollowupChannel;
  sequenceIndex: number;
  scheduledAt: number;
  templateName?: string | null;
  subject?: string | null;
  body: string;
  campaignId?: CampaignId | null;
  createdBy: Uid | "AI" | "CAMPAIGN" | null;
}

export interface UpdateFollowupInput {
  actor: { uid: Uid | "AI" | "SYSTEM"; role?: UserRole | null };
  followupId: FollowupId;
  status?: FollowupStatus;
  executedAt?: number | null;
  refId?: EmailId | WhatsAppMessageId | CallId | null;
  reasonSkipped?: string | null;
}

export interface ListFollowupsParams {
  leadId?: LeadId;
  status?: FollowupStatus | FollowupStatus[];
  channel?: FollowupChannel;
  dueBefore?: number;
  dueAfter?: number;
  limit?: number;
  cursor?: string;
}

export async function createFollowup(
  input: CreateFollowupInput
): Promise<{ ok: true; followup: Followup } | { ok: false; error: string }> {
  if (!isAdminConfigured()) {
    return { ok: false, error: "Firebase Admin not configured" };
  }

  const channelForMiddleware = input.channel === "CALL" ? "VOICE" : input.channel;
  const middlewareResult = await toolMiddleware({
    actor: { uid: input.actor.uid, role: input.actor.role ?? null },
    origin: input.origin,
    channel: channelForMiddleware,
    outbound: true,
    estimatedDollars: 0.001,
    leadId: input.leadId,
    tool: "scheduleFollowup",
  });

  if (!middlewareResult.ok) {
    return { ok: false, error: middlewareResult.error ?? "middleware_error" };
  }
  if (!middlewareResult.allowed) {
    return { ok: false, error: middlewareResult.denyReason ?? "denied" };
  }

  const db = getAdminDb();
  const id = followupId();
  const now = Date.now();

  const followup: Followup = {
    id,
    leadId: input.leadId,
    campaignId: input.campaignId ?? null,
    channel: input.channel,
    sequenceIndex: input.sequenceIndex,
    scheduledAt: input.scheduledAt,
    executedAt: null,
    status: "PENDING",
    templateName: input.templateName ?? null,
    subject: input.subject ?? null,
    body: input.body,
    reasonSkipped: null,
    refId: null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection("followups").doc(id).create(followup);

  await writeAudit({
    actorUid: input.actor.uid,
    event: "FOLLOWUP_SCHEDULE",
    detail: `followup ${id} scheduled for lead ${input.leadId}`,
    leadId: input.leadId,
    data: { followupId: id, channel: input.channel, scheduledAt: input.scheduledAt },
  });

  return { ok: true, followup };
}

export async function updateFollowup(
  input: UpdateFollowupInput
): Promise<{ ok: true; followup: Followup } | { ok: false; error: string }> {
  if (!isAdminConfigured()) {
    return { ok: false, error: "Firebase Admin not configured" };
  }

  const db = getAdminDb();
  const ref = db.collection("followups").doc(input.followupId);
  const snap = await ref.get();

  if (!snap.exists) {
    return { ok: false, error: "Followup not found" };
  }

  const existing = snap.data() as Followup;
  const now = Date.now();

  const patch: Partial<Followup> = { updatedAt: now };

  if (input.status !== undefined) {
    patch.status = input.status;
  }
  if (input.executedAt !== undefined) {
    patch.executedAt = input.executedAt;
  }
  if (input.refId !== undefined) {
    patch.refId = input.refId;
  }
  if (input.reasonSkipped !== undefined) {
    patch.reasonSkipped = input.reasonSkipped;
  }

  await ref.set(patch, { merge: true });

  const updated: Followup = { ...existing, ...patch };

  await writeAudit({
    actorUid: input.actor.uid,
    event: "FOLLOWUP_EXECUTE",
    detail: `followup ${input.followupId} updated status=${input.status ?? existing.status}`,
    leadId: existing.leadId,
    data: {
      followupId: input.followupId,
      previousStatus: existing.status,
      newStatus: input.status ?? existing.status,
    },
  });

  return { ok: true, followup: updated };
}

export async function completeFollowup(
  actor: { uid: Uid | "AI" | "SYSTEM"; role?: UserRole | null },
  followupId: FollowupId,
  refId: EmailId | WhatsAppMessageId | CallId
): Promise<{ ok: true; followup: Followup } | { ok: false; error: string }> {
  return updateFollowup({
    actor,
    followupId,
    status: "COMPLETED",
    executedAt: Date.now(),
    refId,
  });
}

export async function cancelFollowup(
  actor: { uid: Uid | "AI" | "SYSTEM"; role?: UserRole | null },
  followupId: FollowupId,
  reason: "EMERGENCY_STOP" | "MANUAL" = "MANUAL"
): Promise<{ ok: true; followup: Followup } | { ok: false; error: string }> {
  return updateFollowup({
    actor,
    followupId,
    status: reason === "EMERGENCY_STOP" ? "CANCELLED_EMERGENCY_STOP" : "CANCELLED_MANUAL",
    reasonSkipped: reason === "EMERGENCY_STOP" ? "emergency_stop" : "manual_cancel",
  });
}

export async function getFollowup(
  followupId: FollowupId
): Promise<Followup | null> {
  if (!isAdminConfigured()) return null;
  const db = getAdminDb();
  const snap = await db.collection("followups").doc(followupId).get();
  if (!snap.exists) return null;
  return snap.data() as Followup;
}

export async function listFollowups(
  params: ListFollowupsParams
): Promise<{ items: Followup[]; nextCursor: string | null }> {
  if (!isAdminConfigured()) return { items: [], nextCursor: null };

  const db = getAdminDb();
  let query: FirebaseFirestore.Query = db.collection("followups");

  if (params.leadId) {
    query = query.where("leadId", "==", params.leadId);
  }
  if (params.status) {
    const statuses = Array.isArray(params.status) ? params.status : [params.status];
    if (statuses.length === 1) {
      query = query.where("status", "==", statuses[0]);
    } else {
      query = query.where("status", "in", statuses.slice(0, 10));
    }
  }
  if (params.channel) {
    query = query.where("channel", "==", params.channel);
  }
  if (params.dueBefore) {
    query = query.where("scheduledAt", "<=", params.dueBefore);
  }
  if (params.dueAfter) {
    query = query.where("scheduledAt", ">=", params.dueAfter);
  }

  const limit = Math.max(1, Math.min(200, params.limit ?? 50));
  if (params.cursor) {
    try {
      const raw = Buffer.from(params.cursor, "base64url").toString("utf8");
      const parsed = JSON.parse(raw) as { v: number | null };
      const v = parsed.v;
      if (v !== null && typeof v === "number") {
        query = query.where("scheduledAt", ">", v);
      }
    } catch {
      // ignore bad cursor
    }
  }

  query = query.orderBy("scheduledAt", "asc").limit(limit + 1);
  const snap = await query.get();
  const docs = snap.docs.slice();
  let nextCursor: string | null = null;
  const items: Followup[] = [];

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]!;
    if (i >= limit) {
      const data = doc.data() as Partial<Followup>;
      const sortValue = data.scheduledAt ?? null;
      nextCursor = Buffer.from(JSON.stringify({ v: sortValue })).toString("base64url");
      break;
    }
    items.push(doc.data() as Followup);
  }

  return { items, nextCursor };
}

export async function getPendingFollowups(limit = 100): Promise<Followup[]> {
  if (!isAdminConfigured()) return [];
  const db = getAdminDb();
  const now = Date.now();
  const snap = await db
    .collection("followups")
    .where("status", "in", ["PENDING", "SCHEDULED"])
    .where("scheduledAt", "<=", now)
    .orderBy("scheduledAt", "asc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as Followup);
}

export async function getDueFollowupsForExecution(limit = 50): Promise<Followup[]> {
  if (!isAdminConfigured()) return [];
  const db = getAdminDb();
  const now = Date.now();
  const snap = await db
    .collection("followups")
    .where("status", "in", ["PENDING", "SCHEDULED"])
    .where("scheduledAt", "<=", now)
    .orderBy("scheduledAt", "asc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as Followup);
}