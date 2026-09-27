import { getAdminDb, isAdminConfigured } from "@optimus/lib/firebase/admin";
import type { LeadId, Uid, UserRole, ServiceInterest } from "@shared/types";
import { toolMiddleware } from "@optimus/lib/tools/middleware";
import { findOrCreateLead } from "@optimus/lib/domain/leads/service";
import { sendLeadEmail } from "@optimus/lib/domain/email/service";
import { suggestPublicRange } from "@optimus/lib/domain/pricing/service";
import { appendInteraction } from "@optimus/lib/domain/leads/service";

// Bookings service stubs (to be implemented)
async function getTebogoAvailability(_args: { start: number; end: number }): Promise<Array<{ available: boolean; start: number; end: number }>> {
  return [];
}

async function createBooking(_args: { leadId: LeadId; type: string; startsAt: number; durationMinutes: number; mediumUrl?: string; notes?: string }): Promise<{ id: string }> {
  return { id: `booking_${Date.now()}` };
}

interface ToolContext {
  actor: { uid: Uid | "AI" | "SYSTEM"; role?: UserRole | null };
  conversationId: string;
  leadId?: LeadId;
}

async function middlewareCheck(
  ctx: ToolContext,
  channel: "AI" | "EMAIL" | "VOICE" | "WHATSAPP",
  tool: string,
  estimatedDollars = 0,
  leadId?: LeadId | null
) {
  const result = await toolMiddleware({
    actor: ctx.actor,
    origin: "AI",
    channel,
    outbound: channel !== "AI",
    estimatedDollars,
    leadId: leadId ?? ctx.leadId ?? null,
    tool,
  });
  if (!result.ok || !result.allowed) {
    throw new Error(result.ok ? result.denyReason ?? "denied" : result.error ?? "middleware_error");
  }
  return result;
}

export async function handleGetLead(_ctx: ToolContext, args: { leadId: string }) {
  if (!isAdminConfigured()) throw new Error("Firebase Admin not configured");
  const db = getAdminDb();
  const snap = await db.collection("leads").doc(args.leadId).get();
  if (!snap.exists) throw new Error("Lead not found");
  return { ...snap.data(), id: args.leadId };
}

export async function handleListLeads(_ctx: ToolContext, args: { status?: string[]; source?: string; service?: string; q?: string; limit?: number }) {
  if (!isAdminConfigured()) throw new Error("Firebase Admin not configured");
  const db = getAdminDb();
  let query: FirebaseFirestore.Query = db.collection("leads");
  if (args.status?.length) {
    query = args.status.length === 1 ? query.where("status", "==", args.status[0]) : query.where("status", "in", args.status.slice(0, 10));
  }
  if (args.source) query = query.where("source", "==", args.source);
  if (args.service) query = query.where("servicesInterested", "array-contains", args.service);
  if (args.q) query = query.where("_searchTerms", "array-contains", args.q.toLowerCase());
  query = query.orderBy("updatedAt", "desc").limit(args.limit ?? 20);
  const snap = await query.get();
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

export async function handleCreateLead(ctx: ToolContext, args: { firstName?: string; lastName?: string; email?: string; phoneE164?: string; company?: string; source: string; servicesInterested?: string[]; budgetRange?: string; timeline?: string }) {
  await middlewareCheck(ctx, "AI", "createLead", 0, null);
  const result = await findOrCreateLead(ctx.actor, {
    firstName: args.firstName,
    lastName: args.lastName,
    email: args.email,
    phoneE164: args.phoneE164,
    company: args.company,
    source: args.source as any,
    servicesInterested: args.servicesInterested as ServiceInterest[],
    budgetRange: args.budgetRange as any,
    timeline: args.timeline as any,
  });
  if (!result) throw new Error("Failed to create lead");
  return { leadId: result.id, created: result.created };
}

export async function handleUpdateLead(_ctx: ToolContext, args: { leadId: string; status?: string; temperature?: number; nextAction?: string; nextActionAt?: number; aiSummary?: string; notes?: string; tags?: string[] }) {
  await middlewareCheck(_ctx, "AI", "updateLead", 0, args.leadId as LeadId);
  if (!isAdminConfigured()) throw new Error("Firebase Admin not configured");
  const db = getAdminDb();
  const ref = db.collection("leads").doc(args.leadId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Lead not found");
  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  for (const [k, v] of Object.entries(args)) {
    if (k !== "leadId" && v !== undefined) patch[k] = v;
  }
  await ref.set(patch, { merge: true });
  return { ok: true, leadId: args.leadId };
}

export async function handleSendEmail(ctx: ToolContext, args: { leadId: string; subject: string; html?: string; text?: string }) {
  await middlewareCheck(ctx, "EMAIL", "sendEmail", 0.001, args.leadId as LeadId);
  const result = await sendLeadEmail({
    actor: ctx.actor,
    origin: "AI",
    leadId: args.leadId as LeadId,
    toEmail: "", // Will be filled from lead
    subject: args.subject,
    html: args.html,
    text: args.text,
  });
  if (!result.ok) throw new Error(result.error);
  return { emailId: result.emailId };
}

export async function handleSendWhatsApp(_ctx: ToolContext, args: { leadId: string; text: string }) {
  await middlewareCheck(_ctx, "WHATSAPP", "sendWhatsApp", 0.001, args.leadId as LeadId);
  // TODO: Implement WhatsApp send
  return { queued: true, message: "WhatsApp provider not configured" };
}

export async function handleScheduleFollowup(ctx: ToolContext, args: { leadId: string; when: number; task: string; channel: "EMAIL" | "WHATSAPP" | "CALL" }) {
  await middlewareCheck(ctx, args.channel === "EMAIL" ? "EMAIL" : args.channel === "WHATSAPP" ? "WHATSAPP" : "VOICE", "scheduleFollowup", 0, args.leadId as LeadId);
  // TODO: Implement followups service
  return { scheduled: true, followupId: `fu_${Date.now()}` };
}

export async function handleCreateQuote(ctx: ToolContext, args: { leadId: string; items: Array<{ label: string; description?: string; quantity: number; unitRangeLowCents: number; unitRangeHighCents: number; currency: "ZAR" | "USD" }>; note?: string; rangeLowCents: number; rangeHighCents: number; currency: "ZAR" | "USD" }) {
  await middlewareCheck(ctx, "AI", "createQuote", 0, args.leadId as LeadId);
  if (!isAdminConfigured()) throw new Error("Firebase Admin not configured");
  const db = getAdminDb();
  const quoteId = `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const quote = {
    id: quoteId,
    leadId: args.leadId,
    status: "DRAFT",
    title: `Quote for ${args.items.map((i) => i.label).join(", ")}`,
    notes: args.note ?? null,
    terms: null,
    currency: args.currency,
    rangeLowCents: args.rangeLowCents,
    rangeHighCents: args.rangeHighCents,
    exactTotalCents: null,
    shareTokenNonce: null,
    validUntil: now + 30 * 24 * 60 * 60 * 1000,
    items: args.items,
    createdBy: "AI" as const,
    viewedAt: null,
    sentAt: null,
    acceptedAt: null,
    wonAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection("quotes").doc(quoteId).create(quote);
  await appendInteraction(
    ctx.actor,
    args.leadId as LeadId,
    { type: "quote_created", quoteId: quoteId as any, summary: `Quote created: ${quote.title}`, at: now, data: { rangeLow: args.rangeLowCents, rangeHigh: args.rangeHighCents } },
    { silentAudit: true }
  );
  return { quoteId, status: "DRAFT" };
}

export async function handleLogActivity(ctx: ToolContext, args: { leadId: string; type: string; text: string }) {
  await middlewareCheck(ctx, "AI", "logActivity", 0, args.leadId as LeadId);
  const now = Date.now();
  await appendInteraction(
    ctx.actor,
    args.leadId as LeadId,
    { type: "ai_action", aiActionId: `ai_${Date.now()}` as any, summary: args.text, at: now, data: { type: args.type } },
    { silentAudit: true }
  );
  return { logged: true };
}

export async function handleGetConversation(_ctx: ToolContext, args: { conversationId: string }) {
  if (!isAdminConfigured()) throw new Error("Firebase Admin not configured");
  const db = getAdminDb();
  const snap = await db.collection("ai_conversations").doc(args.conversationId).get();
  if (!snap.exists) throw new Error("Conversation not found");
  return { ...snap.data(), id: args.conversationId };
}

export async function handleSuggestPriceRange(_ctx: ToolContext, args: { service: string; brief: string }) {
  await middlewareCheck(_ctx, "AI", "suggestPriceRange", 0, null);
  const range = await suggestPublicRange(args.service as ServiceInterest, args.brief);
  return range;
}

export async function handleGetTebogoAvailability(_ctx: ToolContext, args: { windowStart: number; windowEnd: number }) {
  await middlewareCheck(_ctx, "AI", "getTebogoAvailability", 0, null);
  const slots = await getTebogoAvailability({ start: args.windowStart, end: args.windowEnd });
  return { slots };
}

export async function handleCreateBooking(_ctx: ToolContext, args: { leadId: string; type: "CALLBACK" | "VIDEO" | "IN_PERSON"; startsAt: number; durationMin: number; mediumUrl?: string; notes?: string }) {
  await middlewareCheck(_ctx, "AI", "createBooking", 0, args.leadId as LeadId);
  const booking = await createBooking({
    leadId: args.leadId,
    type: args.type,
    startsAt: args.startsAt,
    durationMinutes: args.durationMin,
    mediumUrl: args.mediumUrl,
    notes: args.notes,
  });
  return { bookingId: booking.id };
}

export async function handleAttemptTebogoHandoff(_ctx: ToolContext, args: { leadId: string; callId?: string; reason: string }) {
  await middlewareCheck(_ctx, "VOICE", "attemptTebogoHandoff", 0, args.leadId as LeadId);
  const availability = await getTebogoAvailability({ start: Date.now(), end: Date.now() + 15 * 60 * 1000 });
  const canAttempt = availability.some((s) => s.available);
  return {
    canAttempt,
    reason: canAttempt ? "Tebogo is available" : "Tebogo is busy",
    suggestion: canAttempt ? "Offer 3-way call" : "Schedule callback/video meeting",
  };
}

export const TOOL_HANDLERS: Record<string, (ctx: ToolContext, args: any) => Promise<any>> = {
  getLead: handleGetLead,
  listLeads: handleListLeads,
  createLead: handleCreateLead,
  updateLead: handleUpdateLead,
  sendEmail: handleSendEmail,
  sendWhatsApp: handleSendWhatsApp,
  scheduleFollowup: handleScheduleFollowup,
  createQuote: handleCreateQuote,
  logActivity: handleLogActivity,
  getConversation: handleGetConversation,
  suggestPriceRange: handleSuggestPriceRange,
  getTebogoAvailability: handleGetTebogoAvailability,
  createBooking: handleCreateBooking,
  attemptTebogoHandoff: handleAttemptTebogoHandoff,
};