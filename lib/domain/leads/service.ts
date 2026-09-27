import { z } from "zod";
import {
  getAdminDb,
  isAdminConfigured,
} from "@optimus/lib/firebase/admin";
import {
  LeadSchema,
  LeadPatchSchema,
} from "@shared/validation/schemas";
import type {
  BookingId,
  CallId,
  EmailId,
  FollowupId,
  InteractionId,
  Lead,
  LeadId,
  LeadPatch,
  LeadSource,
  LeadStatus,
  QuoteId,
  ServiceInterest,
  TimelineEvent,
  Uid,
  UserRole,
  WebsiteEventId,
  WhatsAppMessageId,
} from "@shared/types";
import { writeAudit } from "@optimus/lib/audit/writer";
import { toolMiddleware } from "@optimus/lib/tools/middleware";

export type ListLeadsParams = {
  status?: LeadStatus | LeadStatus[];
  source?: LeadSource;
  service?: ServiceInterest;
  q?: string;
  limit?: number;
  cursor?: string;
  sort?: "updatedAt" | "createdAt" | "lastContactAt";
  sortDir?: "asc" | "desc";
};

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

function uid(): LeadId {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  ) as LeadId;
}

function interactionId(): InteractionId {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  ) as InteractionId;
}

function emptyLeadGuard(): never {
  throw new Error(
    "Firebase Admin not configured. Set FIREBASE_ADMIN_* env vars before using leads service."
  );
}

export async function getLead(
  id: LeadId
): Promise<(Lead & { id: LeadId }) | null> {
  if (!isAdminConfigured()) return null;
  const db = getAdminDb();
  const snap = await db.collection("leads").doc(id).get();
  if (!snap.exists) return null;
  return { ...(snap.data() as Lead), id: id };
}

export async function getLeadByEmail(email: string): Promise<(Lead & { id: LeadId }) | null> {
  if (!isAdminConfigured()) return null;
  const db = getAdminDb();
  const norm = email.trim().toLowerCase();
  const snap = await db
    .collection("leads")
    .where("emailNormalized", "==", norm)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { ...(doc.data() as Lead), id: doc.id as LeadId };
}

export async function getLeadByPhone(phone: string): Promise<(Lead & { id: LeadId }) | null> {
  if (!isAdminConfigured()) return null;
  const db = getAdminDb();
  const snap = await db
    .collection("leads")
    .where("phoneE164", "==", phone)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { ...(doc.data() as Lead), id: doc.id as LeadId };
}

export async function findOrCreateLead(
  actor: { uid: Uid | "SYSTEM" | "AI"; role?: UserRole | null },
  seed: Partial<Lead> & {
    firstName?: string;
    lastName?: string;
    company?: string;
    email?: string;
    phoneE164?: string;
    source: LeadSource;
  }
): Promise<(Lead & { id: LeadId; created?: boolean }) | null> {
  if (!isAdminConfigured()) return null;
  if (seed.email?.trim()) {
    const existing = await getLeadByEmail(seed.email.trim());
    if (existing) return { ...existing, created: false };
  }
  if (seed.phoneE164) {
    const existing = await getLeadByPhone(seed.phoneE164);
    if (existing) return { ...existing, created: false };
  }
  const created = await createLead(actor, seed as any);
  if (!created) return null;
  return { ...created, created: true };
}

export async function listLeads(
  params: ListLeadsParams
): Promise<{
  items: Array<Lead & { id: LeadId }>;
  nextCursor: string | null;
}> {
  if (!isAdminConfigured()) return { items: [], nextCursor: null };
  const db = getAdminDb();
  const limit = Math.max(
    1,
    Math.min(MAX_LIST_LIMIT, params.limit ?? DEFAULT_LIST_LIMIT)
  );
  const sortField: "updatedAt" | "createdAt" | "lastContactAt" =
    params.sort ?? "updatedAt";
  const sortDir: "asc" | "desc" = params.sortDir ?? "desc";
  let q: FirebaseFirestore.Query = db.collection("leads");
  if (params.status) {
    const statuses = Array.isArray(params.status) ? params.status : [params.status];
    if (statuses.length === 1) q = q.where("status", "==", statuses[0]);
    else q = q.where("status", "in", statuses.slice(0, 10));
  }
  if (params.source) q = q.where("source", "==", params.source);
  if (params.service) q = q.where("servicesInterested", "array-contains", params.service);
  if (params.q?.trim()) {
    const qnorm = params.q.trim().toLowerCase();
    q = q.where("_searchTerms", "array-contains", qnorm);
  }
  if (params.cursor) {
    try {
      const raw = Buffer.from(params.cursor, "base64url").toString("utf8");
      const parsed = JSON.parse(raw) as { v: number | null };
      const v = parsed.v;
      if (v !== null && typeof v === "number") {
        q =
          sortDir === "desc"
            ? q.where(sortField, "<", v)
            : q.where(sortField, ">", v);
      }
    } catch {
      // ignore bad cursor
    }
  }
  q = q.orderBy(sortField, sortDir).limit(limit + 1);
  const snap = await q.get();
  const docs = snap.docs.slice();
  let nextCursor: string | null = null;
  const items: Array<Lead & { id: LeadId }> = [];
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]!;
    if (i >= limit) {
      const data = doc.data() as Partial<Lead>;
      const sortValue =
        (sortField === "updatedAt"
          ? data.updatedAt
          : sortField === "createdAt"
            ? data.createdAt
            : data.lastContactAt) ?? null;
      nextCursor = Buffer.from(
        JSON.stringify({ v: sortValue })
      ).toString("base64url");
      break;
    }
    items.push({ ...(doc.data() as Lead), id: doc.id as LeadId });
  }
  return { items, nextCursor };
}

function buildSearchTerms(
  data: Partial<Lead>
): string[] {
  const tokens = new Set<string>();
  const fields: Array<string | null | undefined> = [
    data.firstName,
    data.lastName,
    data.company,
    data.email,
    data.phoneE164,
    data.website,
    data.source,
    data.status,
  ];
  for (const raw of fields) {
    if (!raw) continue;
    const lower = String(raw).toLowerCase();
    tokens.add(lower);
    const parts = lower.split(/[\s@.\-_+#(),:;/\\]+/).filter(Boolean);
    for (const p of parts) if (p.length >= 2) tokens.add(p);
  }
  return Array.from(tokens).slice(0, 200);
}

export async function createLead(
  actor: { uid: Uid | "SYSTEM" | "AI"; role?: UserRole | null },
  input: z.infer<typeof LeadSchema>
): Promise<(Lead & { id: LeadId }) | null> {
  if (!isAdminConfigured()) emptyLeadGuard();
  const db = getAdminDb();
  const parsed = LeadSchema.parse(input);
  const id = uid();
  const now = Date.now();
  const emailNormalized = parsed.email ? parsed.email.trim().toLowerCase() : null;
  const status: LeadStatus = parsed.status ?? "NEW";
  const data: Lead = {
    id,
    firstName: parsed.firstName ?? null,
    lastName: parsed.lastName ?? null,
    fullName: [parsed.firstName, parsed.lastName].filter(Boolean).join(" ").trim() || null,
    name: parsed.name ?? ([parsed.firstName, parsed.lastName].filter(Boolean).join(" ").trim() || null),
    company: parsed.company ?? null,
    title: parsed.title ?? null,
    email: parsed.email ?? null,
    emailNormalized,
    phoneE164: parsed.phoneE164 ?? null,
    whatsAppE164: parsed.whatsappE164 ?? parsed.phoneE164 ?? null,
    whatsappE164: parsed.whatsappE164 ?? parsed.phoneE164 ?? null,
    website: parsed.website ?? null,
    linkedin: parsed.linkedin ?? null,
    address: parsed.address ?? null,
    city: parsed.city ?? null,
    region: parsed.region ?? null,
    countryCode: parsed.countryCode ?? null,
    service: parsed.service ?? null,
    servicesInterested: parsed.servicesInterested ?? [],
    budgetRange: parsed.budgetRange ?? null,
    timeline: parsed.timeline ?? null,
    source: parsed.source ?? "OTHER",
    sourceCampaign: parsed.sourceCampaign ?? null,
    sourceDetail: parsed.sourceDetail ?? null,
    sourceUrl: parsed.sourceUrl ?? null,
    status,
    temperature: parsed.temperature ?? (status === "NEW" ? 25 : status === "HOT" ? 85 : 50),
    assignedUid: parsed.assignedUid ?? null,
    assignedToUid: parsed.assignedToUid ?? null,
    aiSummary: parsed.aiSummary ?? null,
    notes: parsed.notes ?? null,
    score: parsed.score ?? 0,
    lastContactAt: parsed.lastContactAt ?? null,
    nextAction: parsed.nextAction ?? null,
    nextActionAt: parsed.nextActionAt ?? null,
    tags: parsed.tags ?? [],
    gdprOptIn: parsed.gdprOptIn ?? false,
    gdprOptInAt: parsed.gdprOptIn && !parsed.gdprOptInAt ? now : parsed.gdprOptInAt ?? null,
    marketingUnsubscribed: parsed.marketingUnsubscribed ?? false,
    marketingUnsubscribedAt:
      parsed.marketingUnsubscribed && !parsed.marketingUnsubscribedAt
        ? now
        : parsed.marketingUnsubscribedAt ?? null,
    unsubscribeNonce: parsed.unsubscribeNonce ?? null,
    convertedAt: parsed.convertedAt ?? null,
    customerProfileId: parsed.customerProfileId ?? null,
    customFields: parsed.customFields ?? {},
    createdAt: now,
    updatedAt: now,
    _searchTerms: [],
  };
  data._searchTerms = buildSearchTerms(data);
  await db.collection("leads").doc(id).create(data);
  await writeAudit({
    actorUid: actor.uid,
    event: "LEAD_CREATE",
    detail: `lead id=${id} email=${emailNormalized ?? "none"}`,
    leadId: id,
    data: { source: data.source, status: data.status },
  });
  return { ...data, id };
}

export async function updateLead(
  actor: { uid: Uid | "SYSTEM" | "AI"; role?: UserRole | null },
  id: LeadId,
  patch: LeadPatch
): Promise<(Lead & { id: LeadId }) | null> {
  if (!isAdminConfigured()) return null;
  const db = getAdminDb();
  const ref = db.collection("leads").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const prev = snap.data() as Lead;
  const validated = LeadPatchSchema.parse(patch);
  const now = Date.now();
  const merge: Partial<Lead> = { ...validated, updatedAt: now } as Partial<Lead>;
  // Normalize email on change
  if (validated.email !== undefined && validated.email !== prev.email) {
    merge.emailNormalized = validated.email
      ? validated.email.trim().toLowerCase()
      : null;
  }
  // Update fullName if names change
  const fn = validated.firstName ?? prev.firstName;
  const ln = validated.lastName ?? prev.lastName;
  if (validated.firstName !== undefined || validated.lastName !== undefined) {
    merge.fullName = [fn, ln].filter(Boolean).join(" ").trim() || null;
  }
  if (
    validated.gdprOptIn === true &&
    (prev.gdprOptIn !== true || !prev.gdprOptInAt)
  ) {
    merge.gdprOptInAt = now;
  }
  if (
    validated.marketingUnsubscribed === true &&
    (prev.marketingUnsubscribed !== true || !prev.marketingUnsubscribedAt)
  ) {
    merge.marketingUnsubscribedAt = now;
  }
  if (validated.status === "WON" && !prev.convertedAt) merge.convertedAt = now;
  // Update status -> temperature hints
  if (validated.status) {
    if (validated.status === "NEW" && merge.temperature === undefined)
      merge.temperature = 25;
    else if (validated.status === "REPLIED" && merge.temperature === undefined)
      merge.temperature = 55;
    else if (validated.status === "QUALIFIED" && merge.temperature === undefined)
      merge.temperature = 65;
    else if (validated.status === "HOT" && merge.temperature === undefined)
      merge.temperature = 85;
  }
  const next: Lead = { ...prev, ...merge };
  next._searchTerms = buildSearchTerms(next);
  await ref.set(next, { merge: false });
  const changedFields: string[] = [];
  for (const k of Object.keys(validated) as Array<keyof LeadPatch>) {
    const a = JSON.stringify((prev as any)[k]);
    const b = JSON.stringify((next as any)[k]);
    if (a !== b) changedFields.push(String(k));
  }
  await writeAudit({
    actorUid: actor.uid,
    event: "LEAD_UPDATE",
    detail: `lead id=${id} fields=${changedFields.join(",") || "none"}`,
    leadId: id,
    data: { changedFields, before: { status: prev.status }, after: { status: next.status } },
  });
  return { ...next, id };
}

export type InteractionPayload =
  | {
      type: "website_event";
      websiteEventId: WebsiteEventId;
      eventType: string;
      summary: string;
      at?: number;
      data?: Record<string, any>;
    }
  | {
      type: "email_sent" | "email_delivered" | "email_opened" | "email_clicked" | "email_replied" | "email_failed";
      emailId: EmailId;
      summary: string;
      at?: number;
      subject?: string;
      data?: Record<string, any>;
    }
  | {
      type: "whatsapp_sent" | "whatsapp_received";
      whatsappId: WhatsAppMessageId;
      summary: string;
      at?: number;
      data?: Record<string, any>;
    }
  | {
      type: "call_started" | "call_completed" | "call_missed";
      callId: CallId;
      summary: string;
      at?: number;
      data?: Record<string, any>;
    }
  | {
      type: "quote_created" | "quote_sent" | "quote_accepted" | "quote_won" | "quote_lost";
      quoteId: QuoteId;
      summary: string;
      at?: number;
      data?: Record<string, any>;
    }
  | {
      type: "booking_created" | "booking_confirmed" | "booking_completed" | "booking_cancelled";
      bookingId: BookingId;
      summary: string;
      at?: number;
      data?: Record<string, any>;
    }
  | {
      type: "followup_scheduled" | "followup_sent" | "followup_cancelled";
      followupId: FollowupId;
      summary: string;
      at?: number;
      data?: Record<string, any>;
    }
  | {
      type: "ai_summary" | "ai_action" | "ai_handoff";
      aiConversationId?: string;
      aiActionId?: string;
      summary: string;
      at?: number;
      data?: Record<string, any>;
    }
  | {
      type: "status_change";
      from: LeadStatus;
      to: LeadStatus;
      summary: string;
      at?: number;
      data?: Record<string, any>;
    }
  | {
      type: "note_added";
      summary: string;
      at?: number;
      data?: Record<string, any>;
    }
  | {
      type: "manual";
      summary: string;
      at?: number;
      data?: Record<string, any>;
    };

export async function appendInteraction(
  actor: { uid: Uid | "SYSTEM" | "AI"; role?: UserRole | null },
  leadId: LeadId,
  payload: InteractionPayload,
  opts?: { silentAudit?: boolean; updateLastContactAt?: boolean }
): Promise<{ id: InteractionId; at: number } | null> {
  if (!isAdminConfigured()) return null;
  const db = getAdminDb();
  const id = interactionId();
  const at = payload.at ?? Date.now();
  const base: {
    id: InteractionId;
    type: string;
    at: number;
    summary: string;
    actorUid: Uid | "SYSTEM" | "AI";
    data?: Record<string, any>;
    refIds: Partial<{
      websiteEventId: WebsiteEventId;
      emailId: EmailId;
      whatsappId: WhatsAppMessageId;
      callId: CallId;
      quoteId: QuoteId;
      bookingId: BookingId;
      followupId: FollowupId;
      aiConversationId: string;
      aiActionId: string;
    }>;
  } = {
    id,
    type: payload.type,
    at,
    summary: payload.summary,
    actorUid: actor.uid,
    data: payload.data,
    refIds: {},
  };
  switch (payload.type) {
    case "website_event":
      base.refIds.websiteEventId = payload.websiteEventId;
      base.data = { ...(base.data ?? {}), eventType: payload.eventType };
      break;
    case "email_sent":
    case "email_delivered":
    case "email_opened":
    case "email_clicked":
    case "email_replied":
    case "email_failed":
      base.refIds.emailId = payload.emailId;
      base.data = { ...(base.data ?? {}), subject: payload.subject ?? null };
      break;
    case "whatsapp_sent":
    case "whatsapp_received":
      base.refIds.whatsappId = payload.whatsappId as WhatsAppMessageId;
      break;
    case "call_started":
    case "call_completed":
    case "call_missed":
      base.refIds.callId = payload.callId;
      break;
    case "quote_created":
    case "quote_sent":
    case "quote_accepted":
    case "quote_won":
    case "quote_lost":
      base.refIds.quoteId = payload.quoteId;
      break;
    case "booking_created":
    case "booking_confirmed":
    case "booking_completed":
    case "booking_cancelled":
      base.refIds.bookingId = payload.bookingId;
      break;
    case "followup_scheduled":
    case "followup_sent":
    case "followup_cancelled":
      base.refIds.followupId = payload.followupId;
      break;
    case "ai_summary":
    case "ai_action":
    case "ai_handoff":
      base.refIds.aiConversationId = payload.aiConversationId;
      base.refIds.aiActionId = payload.aiActionId;
      break;
    default:
      break;
  }
  await db
    .collection("leads")
    .doc(leadId)
    .collection("interactions")
    .doc(id)
    .create(base);
  const updateLastContact =
    opts?.updateLastContactAt ??
    (!base.type.startsWith("ai_") && base.type !== "note_added" && base.type !== "manual");
  const leadPatch: Partial<Lead> = { updatedAt: at };
  if (updateLastContact) leadPatch.lastContactAt = at;
  await db.collection("leads").doc(leadId).set(leadPatch, { merge: true });
  if (!opts?.silentAudit) {
    await writeAudit({
      actorUid: actor.uid,
      event: "LEAD_UPDATE",
      detail: `lead=${leadId} type=${base.type} id=${id}`,
      leadId,
      data: { interactionId: id, interactionType: base.type },
    });
  }
  return { id, at };
}

export async function getTimeline(
  leadId: LeadId,
  opts?: { limit?: number }
): Promise<TimelineEvent[]> {
  const limit = opts?.limit ?? 200;
  const out: TimelineEvent[] = [];
  if (!isAdminConfigured()) return out;
  const db = getAdminDb();
  const lead = await getLead(leadId);
  if (!lead) return out;
  const interactionsSnap = await db
    .collection("leads")
    .doc(leadId)
    .collection("interactions")
    .orderBy("at", "desc")
    .limit(Math.min(500, limit))
    .get();
  for (const d of interactionsSnap.docs) {
    const r = d.data() as any;
    out.push({
      id: r.id ?? d.id,
      type: r.type as TimelineEvent["type"],
      at: Number(r.at) ?? Date.now(),
      summary: r.summary ?? "",
      icon: iconFor(r.type),
      detail: r.data ?? null,
      refIds: r.refIds ?? {},
      actorUid: r.actorUid ?? null,
      leadId,
    });
  }
  // Join with domain records (emails, calls, whatsapp, quotes, bookings, followups, website_events, audit)
  const joins: Promise<void>[] = [];
  const emails = db
    .collection("emails")
    .where("leadId", "==", leadId)
    .orderBy("createdAt", "desc")
    .limit(Math.min(100, limit));
  joins.push(
    emails.get().then((snap) => {
      for (const d of snap.docs) {
        const r = d.data() as any;
        const at = Number(r.createdAt ?? r.sentAt ?? Date.now());
        out.push({
          id: `email:${d.id}`,
          type: r.status === "SENT" ? "email_sent" : (r.status === "REPLIED" ? "email_replied" : "email_sent"),
          at,
          summary:
            r.status === "SENT"
              ? `Email sent: ${r.subject ?? "(no subject)"}`
              : r.status === "REPLIED"
                ? `Email reply: ${r.subject ?? "(no subject)"}`
                : `Email: ${r.subject ?? "(no subject)"}`,
          icon: r.status === "REPLIED" ? "📨" : "📧",
          detail: { from: r.from, to: r.to, status: r.status },
          refIds: { emailId: d.id as EmailId },
          actorUid: null,
          leadId,
        });
      }
    })
  );
  const calls = db
    .collection("calls")
    .where("leadId", "==", leadId)
    .orderBy("createdAt", "desc")
    .limit(Math.min(100, limit));
  joins.push(
    calls.get().then((snap) => {
      for (const d of snap.docs) {
        const r = d.data() as any;
        const at = Number(r.startedAt ?? r.createdAt ?? Date.now());
        const outcome: string = r.outcome ?? "UNKNOWN";
        const duration = Number(r.durationSeconds ?? 0) | 0;
        out.push({
          id: `call:${d.id}`,
          type:
            outcome === "ANSWERED" ? "call_completed" :
            outcome === "MISSED" ? "call_missed" : "call_started",
          at,
          summary:
            r.direction === "INBOUND"
              ? `Inbound call: ${duration}s (${outcome})`
              : `Outbound call: ${duration}s (${outcome})`,
          icon: "📞",
          detail: { outcome, direction: r.direction, duration },
          refIds: { callId: d.id as CallId },
          actorUid: null,
          leadId,
        });
      }
    })
  );
  const whats = db
    .collection("whatsapp")
    .where("leadId", "==", leadId)
    .orderBy("createdAt", "desc")
    .limit(Math.min(200, limit));
  joins.push(
    whats.get().then((snap) => {
      for (const d of snap.docs) {
        const r = d.data() as any;
        const at = Number(r.createdAt ?? Date.now());
        const dir: string = r.direction ?? "UNKNOWN";
        out.push({
          id: `wa:${d.id}`,
          type: dir === "OUTBOUND" ? "whatsapp_sent" : "whatsapp_received",
          at,
          summary: `${dir === "OUTBOUND" ? "Sent" : "Received"}: ${truncate(r.body ?? "", 120)}`,
          icon: "💬",
          detail: { direction: dir, status: r.status },
          refIds: { whatsappId: d.id as WhatsAppMessageId },
          actorUid: null,
          leadId,
        });
      }
    })
  );
  const quotes = db
    .collection("quotes")
    .where("leadId", "==", leadId)
    .orderBy("createdAt", "desc")
    .limit(Math.min(50, limit));
  joins.push(
    quotes.get().then((snap) => {
      for (const d of snap.docs) {
        const r = d.data() as any;
        const at = Number(r.createdAt ?? Date.now());
        out.push({
          id: `quote:${d.id}`,
          type:
            r.status === "WON" ? "quote_won" :
            r.status === "LOST" ? "quote_lost" :
            r.status === "SENT" ? "quote_sent" : "quote_created",
          at,
          summary: `Quote ${r.status ?? "DRAFT"}: ${r.title ?? "(untitled)"} ${
            r.rangeLow && r.rangeHigh ? `(${r.currency ?? "ZAR"} ${r.rangeLow}–${r.rangeHigh})` : ""
          }`,
          icon: "💰",
          detail: { status: r.status, currency: r.currency ?? "ZAR", rangeLow: r.rangeLow ?? null, rangeHigh: r.rangeHigh ?? null },
          refIds: { quoteId: d.id as QuoteId },
          actorUid: null,
          leadId,
        });
      }
    })
  );
  const bookings = db
    .collection("bookings")
    .where("leadId", "==", leadId)
    .orderBy("createdAt", "desc")
    .limit(Math.min(50, limit));
  joins.push(
    bookings.get().then((snap) => {
      for (const d of snap.docs) {
        const r = d.data() as any;
        const at = Number(r.createdAt ?? r.startsAt ?? Date.now());
        const type: TimelineEvent["type"] =
          r.status === "CONFIRMED" ? "booking_confirmed" :
          r.status === "CANCELLED" ? "booking_cancelled" :
          r.status === "COMPLETED" ? "booking_completed" : "booking_created";
        out.push({
          id: `booking:${d.id}`,
          type,
          summary: `${r.type ?? "CALLBACK"} ${r.status ?? "PENDING"} @ ${new Date(Number(r.startsAt ?? at)).toISOString()}`,
          at,
          icon: "📅",
          detail: { type: r.type, status: r.status, durationMinutes: r.durationMinutes ?? null },
          refIds: { bookingId: d.id as BookingId },
          actorUid: null,
          leadId,
        });
      }
    })
  );
  const followups = db
    .collection("followups")
    .where("leadId", "==", leadId)
    .orderBy("scheduledAt", "desc")
    .limit(Math.min(50, limit));
  joins.push(
    followups.get().then((snap) => {
      for (const d of snap.docs) {
        const r = d.data() as any;
        const at = Number(r.scheduledAt ?? r.createdAt ?? Date.now());
        const type: TimelineEvent["type"] =
          r.status === "COMPLETED" ? "followup_sent" :
          r.status === "CANCELLED_EMERGENCY_STOP" || r.status === "CANCELLED"
            ? "followup_cancelled"
            : "followup_scheduled";
        out.push({
          id: `fu:${d.id}`,
          type,
          summary: `${r.channel ?? "EMAIL"} follow-up (${r.status ?? "PENDING"}): ${truncate(r.body ?? "", 100)}`,
          at,
          icon: "⏰",
          detail: { channel: r.channel ?? "EMAIL", status: r.status },
          refIds: { followupId: d.id as FollowupId },
          actorUid: null,
          leadId,
        });
      }
    })
  );
  const w = db
    .collection("website_events")
    .where("leadId", "==", leadId)
    .orderBy("createdAt", "desc")
    .limit(Math.min(100, limit));
  joins.push(
    w.get().then((snap) => {
      for (const d of snap.docs) {
        const r = d.data() as any;
        const at = Number(r.createdAt ?? Date.now());
        out.push({
          id: `we:${d.id}`,
          type: "website_event",
          summary: `${r.type ?? "event"}${r.url ? ` · ${r.url}` : ""}${r.detail ? ` · ${r.detail}` : ""}`,
          at,
          icon: "🌐",
          detail: { eventType: r.type ?? null, url: r.url ?? null, ip: r.ip ?? null },
          refIds: { websiteEventId: d.id as WebsiteEventId },
          actorUid: null,
          leadId,
        });
      }
    })
  );
  const audit = db
    .collection("audit_logs")
    .where("leadId", "==", leadId)
    .orderBy("ts", "desc")
    .limit(Math.min(100, limit));
  joins.push(
    audit.get().then((snap) => {
      for (const d of snap.docs) {
        const r = d.data() as any;
        const at = Number(r.ts ?? Date.now());
        out.push({
          id: `audit:${d.id}`,
          type: "manual",
          summary: `${r.event ?? "audit"}: ${truncate(r.detail ?? "", 120)}`,
          at,
          icon: "🗂️",
          detail: { event: r.event ?? null, detail: r.detail ?? null },
          refIds: {},
          actorUid: (r.actorUid ?? null) as Uid | null,
          leadId,
        });
      }
    })
  );
  await Promise.all(joins);
  const seen = new Set<string>();
  const dedup: TimelineEvent[] = [];
  for (const e of out) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    dedup.push(e);
  }
  dedup.sort((a, b) => b.at - a.at);
  return dedup.slice(0, Math.max(1, limit));
}

function iconFor(type: string): string {
  switch (type) {
    case "website_event": return "🌐";
    case "email_sent": return "📤";
    case "email_delivered": return "📥";
    case "email_opened": return "👁️";
    case "email_clicked": return "🔗";
    case "email_replied": return "📨";
    case "email_failed": return "⚠️";
    case "whatsapp_sent": return "➡️";
    case "whatsapp_received": return "💬";
    case "call_started": return "📞";
    case "call_completed": return "✅";
    case "call_missed": return "🚫";
    case "quote_created": return "💰";
    case "quote_sent": return "📤";
    case "quote_accepted": return "✅";
    case "quote_won": return "🏆";
    case "quote_lost": return "❌";
    case "booking_created": return "📅";
    case "booking_confirmed": return "✅";
    case "booking_completed": return "✅";
    case "booking_cancelled": return "❌";
    case "followup_scheduled": return "⏰";
    case "followup_sent": return "✅";
    case "followup_cancelled": return "❌";
    case "ai_summary": return "🤖";
    case "ai_action": return "🤖";
    case "ai_handoff": return "🙋";
    case "status_change": return "🔁";
    case "note_added": return "📝";
    default: return "📌";
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, Math.max(1, n - 1)) + "…";
}

export async function enforcePermissionAndBudgetForCreate(
  actor: { uid: Uid | "SYSTEM" | "AI"; role?: UserRole | null },
  reqLike?: { headers?: Record<string, string> | { get: (k: string) => string | null } | null }
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const m = await toolMiddleware({
    actor: { uid: actor.uid as Uid, role: (actor.role ?? null) as any },
    origin: "SYSTEM" as any,
    channel: "AI",
    outbound: false,
    leadId: null as any,
    tool: "createLead",
    estimatedMessages: 0,
    estimatedDollars: 0,
    req: (reqLike ?? null) as any,
  });
  if (!m.ok) return { ok: false, status: 500, error: "internal" };
  if (!m.allowed) return { ok: false, status: 429, error: m.denyCode ?? "denied" };
  return { ok: true };
}
