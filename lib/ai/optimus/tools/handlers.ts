import { getAdminDb, isAdminConfigured } from "@optimus/lib/firebase/admin";
import type { Uid, LeadId, ServiceInterest } from "@shared/types";
import { toolMiddleware } from "@optimus/lib/tools/middleware";
import { findOrCreateLead } from "@optimus/lib/domain/leads/service";
import { sendLeadEmail } from "@optimus/lib/domain/email/service";
import { appendInteraction } from "@optimus/lib/domain/leads/service";
import { getTileSummary } from "@optimus/lib/analytics/summary";
import {
  getOptimusMemory,
  setOptimusMemory,
  deleteOptimusMemory,
  getOptimusGoals,
  createOptimusGoal,
  updateOptimusGoal,
  deleteOptimusGoal,
  getOptimusProjects,
  createOptimusProject,
  updateOptimusProject,
  getOptimusTasks,
  createOptimusTask,
  updateOptimusTask,
  completeOptimusTask,
  getOptimusReminders,
  createOptimusReminder,
  getOptimusDecisions,
  createOptimusDecision,
  getOptimusLessons,
  createOptimusLesson,
  getOptimusPlans,
  createOptimusPlan,
  updateOptimusPlan,
  logOptimusActivity,
  getOptimusActivityLog,
} from "../brain";

interface OptimusToolContext {
  actor: { uid: Uid | "OPTIMUS" | "SYSTEM"; role?: any };
  conversationId: string;
  userId: Uid;
}

async function middlewareCheck(
  ctx: OptimusToolContext,
  channel: "AI" | "EMAIL" | "VOICE" | "WHATSAPP",
  tool: string,
  estimatedDollars = 0,
  leadId?: LeadId
) {
  const result = await toolMiddleware({
    actor: ctx.actor,
    origin: "AI",
    channel,
    outbound: channel !== "AI",
    estimatedDollars,
    tool,
    leadId,
  });
  if (!result.ok || !result.allowed) {
    throw new Error(result.ok ? result.denyReason ?? "denied" : result.error ?? "middleware_error");
  }
  return result;
}

// Memory handlers
export async function handleMemoryGet(_ctx: OptimusToolContext, args: { category?: string; key?: string }) {
  await middlewareCheck(_ctx, "AI", "memory_get", 0);
  const memories = await getOptimusMemory(_ctx.userId, args.category);
  if (args.key) {
    const found = memories.find((m) => m.key === args.key);
    return found ? { value: found.value, metadata: found.metadata } : { found: false };
  }
  return { memories: memories.map((m) => ({ id: m.id, category: m.category, key: m.key, value: m.value, metadata: m.metadata, updatedAt: m.updatedAt })) };
}

export async function handleMemorySet(ctx: OptimusToolContext, args: { category: string; key: string; value: unknown; metadata?: Record<string, unknown> }) {
  await middlewareCheck(ctx, "AI", "memory_set", 0);
  const memory = await setOptimusMemory(ctx.userId, args.category as any, args.key, args.value, args.metadata);
  return { id: memory.id, key: memory.key, category: memory.category };
}

export async function handleMemoryDelete(_ctx: OptimusToolContext, args: { id: string }) {
  await middlewareCheck(_ctx, "AI", "memory_delete", 0);
  await deleteOptimusMemory(_ctx.userId, args.id);
  return { deleted: true };
}

// Goals handlers
export async function handleGoalsList(_ctx: OptimusToolContext, _args: {}) {
  await middlewareCheck(_ctx, "AI", "goals_list", 0);
  const goals = await getOptimusGoals(_ctx.userId);
  return { goals: goals.map((g) => ({ id: g.id, title: g.title, description: g.description, horizon: g.horizon, status: g.status, targetDate: g.targetDate, projectIds: g.projectIds })) };
}

export async function handleGoalsCreate(ctx: OptimusToolContext, args: { title: string; description: string; horizon: string; targetDate?: number; metrics?: Record<string, number> }) {
  await middlewareCheck(ctx, "AI", "goals_create", 0);
  const goal = await createOptimusGoal(ctx.userId, {
    title: args.title,
    description: args.description,
    horizon: args.horizon as any,
    status: "active",
    targetDate: args.targetDate,
    metrics: args.metrics,
    projectIds: [],
  });
  return { id: goal.id, title: goal.title };
}

export async function handleGoalsUpdate(_ctx: OptimusToolContext, args: { id: string; title?: string; description?: string; status?: string; targetDate?: number; metrics?: Record<string, number> }) {
  await middlewareCheck(_ctx, "AI", "goals_update", 0);
  const goal = await updateOptimusGoal(_ctx.userId, args.id, {
    title: args.title,
    description: args.description,
    status: args.status as any,
    targetDate: args.targetDate,
    metrics: args.metrics,
  });
  return goal ? { id: goal.id, title: goal.title } : { error: "Not found" };
}

export async function handleGoalsDelete(_ctx: OptimusToolContext, args: { id: string }) {
  await middlewareCheck(_ctx, "AI", "goals_delete", 0);
  await deleteOptimusGoal(_ctx.userId, args.id);
  return { deleted: true };
}

// Projects handlers
export async function handleProjectsList(_ctx: OptimusToolContext, _args: {}) {
  await middlewareCheck(_ctx, "AI", "projects_list", 0);
  const projects = await getOptimusProjects(_ctx.userId);
  return { projects: projects.map((p) => ({ id: p.id, name: p.name, description: p.description, status: p.status, goalIds: p.goalIds })) };
}

export async function handleProjectsCreate(ctx: OptimusToolContext, args: { name: string; description: string; goalIds?: string[]; status?: string; targetEndDate?: number; tags?: string[] }) {
  await middlewareCheck(ctx, "AI", "projects_create", 0);
  const project = await createOptimusProject(ctx.userId, {
    name: args.name,
    description: args.description,
    goalIds: args.goalIds ?? [],
    status: (args.status as any) ?? "planning",
    targetEndDate: args.targetEndDate,
    tags: args.tags ?? [],
  });
  return { id: project.id, name: project.name };
}

export async function handleProjectsUpdate(_ctx: OptimusToolContext, args: { id: string; name?: string; description?: string; status?: string; targetEndDate?: number; tags?: string[] }) {
  await middlewareCheck(_ctx, "AI", "projects_update", 0);
  const project = await updateOptimusProject(_ctx.userId, args.id, {
    name: args.name,
    description: args.description,
    status: args.status as any,
    targetEndDate: args.targetEndDate,
    tags: args.tags,
  });
  return project ? { id: project.id, name: project.name } : { error: "Not found" }
}

// Tasks handlers
export async function handleTasksList(_ctx: OptimusToolContext, args: { projectId?: string; status?: string }) {
  await middlewareCheck(_ctx, "AI", "tasks_list", 0);
  const tasks = await getOptimusTasks(_ctx.userId, args.projectId);
  return { tasks: tasks.filter((t) => !args.status || t.status === args.status).map((t) => ({ id: t.id, title: t.title, description: t.description, status: t.status, priority: t.priority, projectId: t.projectId, goalId: t.goalId, dueDate: t.dueDate, scheduledDate: t.scheduledDate })) };
}

export async function handleTasksCreate(ctx: OptimusToolContext, args: { title: string; description?: string; projectId?: string; goalId?: string; milestoneId?: string; priority?: string; dueDate?: number; scheduledDate?: number; estimatedMinutes?: number; tags?: string[]; recurrence?: any }) {
  await middlewareCheck(ctx, "AI", "tasks_create", 0);
  const task = await createOptimusTask(ctx.userId, {
    title: args.title,
    description: args.description ?? "",
    projectId: args.projectId,
    goalId: args.goalId,
    milestoneId: args.milestoneId,
    status: "backlog",
    priority: (args.priority as any) ?? "medium",
    dueDate: args.dueDate,
    scheduledDate: args.scheduledDate,
    estimatedMinutes: args.estimatedMinutes,
    tags: args.tags ?? [],
    recurrence: args.recurrence,
    dependencies: [],
  });
  return { id: task.id, title: task.title };
}

export async function handleTasksUpdate(_ctx: OptimusToolContext, args: { id: string; title?: string; description?: string; status?: string; priority?: string; dueDate?: number; scheduledDate?: number; estimatedMinutes?: number; tags?: string[] }) {
  await middlewareCheck(_ctx, "AI", "tasks_update", 0);
  const task = await updateOptimusTask(_ctx.userId, args.id, {
    title: args.title,
    description: args.description,
    status: args.status as any,
    priority: args.priority as any,
    dueDate: args.dueDate,
    scheduledDate: args.scheduledDate,
    estimatedMinutes: args.estimatedMinutes,
    tags: args.tags,
  });
  return task ? { id: task.id, title: task.title } : { error: "Not found" };
}

export async function handleTasksComplete(_ctx: OptimusToolContext, args: { id: string }) {
  await middlewareCheck(_ctx, "AI", "tasks_complete", 0);
  const task = await completeOptimusTask(_ctx.userId, args.id);
  return task ? { id: task.id, completed: true } : { error: "Not found" };
}

// Reminders handlers
export async function handleRemindersList(_ctx: OptimusToolContext, _args: {}) {
  await middlewareCheck(_ctx, "AI", "reminders_list", 0);
  const reminders = await getOptimusReminders(_ctx.userId);
  return { reminders: reminders.map((r) => ({ id: r.id, title: r.title, dueAt: r.dueAt, status: r.status, recurrence: r.recurrence })) };
}

export async function handleRemindersCreate(ctx: OptimusToolContext, args: { title: string; description?: string; dueAt: number; recurrence?: any; relatedEntityType?: string; relatedEntityId?: string; notificationChannels?: string[] }) {
  await middlewareCheck(ctx, "AI", "reminders_create", 0);
  const reminder = await createOptimusReminder(ctx.userId, {
    title: args.title,
    description: args.description,
    dueAt: args.dueAt,
    recurrence: args.recurrence,
    status: "pending",
    relatedEntityType: args.relatedEntityType as any,
    relatedEntityId: args.relatedEntityId,
    notificationChannels: (args.notificationChannels as any) ?? ["dashboard"],
  });
  return { id: reminder.id, title: reminder.title };
}

export async function handleRemindersUpdate(_ctx: OptimusToolContext, args: { id: string; title?: string; status?: string }) {
  await middlewareCheck(_ctx, "AI", "reminders_update", 0);
  // Simplified - just update status
  if (!isAdminConfigured()) return { error: "Not configured" };
  const db = getAdminDb();
  const ref = db.collection("optimus_reminders").doc(args.id);
  const snap = await ref.get();
  if (!snap.exists) return { error: "Not found" };
  const data = snap.data() as any;
  if (data.userId !== _ctx.userId) return { error: "Not found" };
  const patch: any = { updatedAt: Date.now() };
  if (args.title !== undefined) patch.title = args.title;
  if (args.status !== undefined) patch.status = args.status;
  await ref.set(patch, { merge: true });
  return { updated: true };
}

// Decisions handlers
export async function handleDecisionsList(_ctx: OptimusToolContext, _args: {}) {
  await middlewareCheck(_ctx, "AI", "decisions_list", 0);
  const decisions = await getOptimusDecisions(_ctx.userId);
  return { decisions: decisions.map((d) => ({ id: d.id, title: d.title, decision: d.decision, createdAt: d.createdAt })) };
}

export async function handleDecisionsCreate(ctx: OptimusToolContext, args: { title: string; description: string; context: string; decision: string; reasoning: string; alternativesConsidered?: string[]; rejectedOptions?: string[]; tags?: string[]; relatedGoalIds?: string[]; relatedProjectIds?: string[] }) {
  await middlewareCheck(ctx, "AI", "decisions_create", 0);
  const decision = await createOptimusDecision(ctx.userId, {
    title: args.title,
    description: args.description,
    context: args.context,
    decision: args.decision,
    reasoning: args.reasoning,
    alternativesConsidered: args.alternativesConsidered ?? [],
    rejectedOptions: args.rejectedOptions ?? [],
    tags: args.tags ?? [],
    relatedGoalIds: args.relatedGoalIds ?? [],
    relatedProjectIds: args.relatedProjectIds ?? [],
  });
  return { id: decision.id, title: decision.title };
}

// Lessons handlers
export async function handleLessonsList(_ctx: OptimusToolContext, _args: {}) {
  await middlewareCheck(_ctx, "AI", "lessons_list", 0);
  const lessons = await getOptimusLessons(_ctx.userId);
  return { lessons: lessons.map((l) => ({ id: l.id, lesson: l.lesson, triggerAction: l.triggerAction, confidence: l.confidence, createdAt: l.createdAt })) };
}

export async function handleLessonsCreate(ctx: OptimusToolContext, args: { triggerAction: string; actionType: string; context: Record<string, unknown>; result: Record<string, unknown>; metrics?: Record<string, number>; whatWorked?: string[]; whatDidntWork?: string[]; lesson: string; confidence?: number; tags?: string[]; appliesTo?: string[] }) {
  await middlewareCheck(ctx, "AI", "lessons_create", 0);
  const lesson = await createOptimusLesson(ctx.userId, {
    triggerAction: args.triggerAction,
    actionType: args.actionType,
    context: args.context,
    result: args.result,
    metrics: args.metrics ?? {},
    whatWorked: args.whatWorked ?? [],
    whatDidntWork: args.whatDidntWork ?? [],
    lesson: args.lesson,
    confidence: args.confidence ?? 0.5,
    tags: args.tags ?? [],
    appliesTo: args.appliesTo ?? [],
  });
  return { id: lesson.id, lesson: lesson.lesson };
}

// Plans handlers
export async function handlePlansList(_ctx: OptimusToolContext, _args: {}) {
  await middlewareCheck(_ctx, "AI", "plans_list", 0);
  const plans = await getOptimusPlans(_ctx.userId);
  return { plans: plans.map((p) => ({ id: p.id, goalId: p.goalId, title: p.title, horizon: p.horizon, status: p.status })) };
}

export async function handlePlansCreate(ctx: OptimusToolContext, args: { goalId: string; title: string; description: string; horizon: string; milestones?: any[]; tasks?: any[]; dependencies?: any[] }) {
  await middlewareCheck(ctx, "AI", "plans_create", 0);
  const plan = await createOptimusPlan(ctx.userId, {
    goalId: args.goalId,
    title: args.title,
    description: args.description,
    horizon: args.horizon as any,
    milestones: args.milestones ?? [],
    tasks: args.tasks ?? [],
    dependencies: args.dependencies ?? [],
    status: "draft",
  });
  return { id: plan.id, title: plan.title };
}

export async function handlePlansUpdate(_ctx: OptimusToolContext, args: { id: string; title?: string; status?: string }) {
  await middlewareCheck(_ctx, "AI", "plans_update", 0);
  const plan = await updateOptimusPlan(_ctx.userId, args.id, {
    title: args.title,
    status: args.status as any,
  });
  return plan ? { id: plan.id, title: plan.title } : { error: "Not found" };
}

// Business Data Read handlers
export async function handleBusinessReadLeads(_ctx: OptimusToolContext, args: { status?: string[]; limit?: number }) {
  await middlewareCheck(_ctx, "AI", "business_read_leads", 0);
  if (!isAdminConfigured()) return { leads: [] };
  const db = getAdminDb();
  let query: FirebaseFirestore.Query = db.collection("leads");
  if (args.status?.length) {
    query = args.status.length === 1 ? query.where("status", "==", args.status[0]) : query.where("status", "in", args.status.slice(0, 10));
  }
  query = query.orderBy("updatedAt", "desc").limit(args.limit ?? 20);
  const snap = await query.get();
  return { leads: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
}

export async function handleBusinessReadConversations(_ctx: OptimusToolContext, args: { leadId?: string; limit?: number }) {
  await middlewareCheck(_ctx, "AI", "business_read_conversations", 0);
  if (!isAdminConfigured()) return { conversations: [] };
  const db = getAdminDb();
  let query: FirebaseFirestore.Query = db.collection("ai_conversations");
  if (args.leadId) query = query.where("leadId", "==", args.leadId);
  query = query.orderBy("updatedAt", "desc").limit(args.limit ?? 20);
  const snap = await query.get();
  return { conversations: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
}

export async function handleBusinessReadEmails(_ctx: OptimusToolContext, args: { leadId?: string; status?: string; limit?: number }) {
  await middlewareCheck(_ctx, "AI", "business_read_emails", 0);
  if (!isAdminConfigured()) return { emails: [] };
  const db = getAdminDb();
  let query: FirebaseFirestore.Query = db.collection("emails");
  if (args.leadId) query = query.where("leadId", "==", args.leadId);
  if (args.status) query = query.where("status", "==", args.status);
  query = query.orderBy("createdAt", "desc").limit(args.limit ?? 20);
  const snap = await query.get();
  return { emails: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
}

export async function handleBusinessReadCalls(_ctx: OptimusToolContext, args: { leadId?: string; outcome?: string; limit?: number }) {
  await middlewareCheck(_ctx, "AI", "business_read_calls", 0);
  if (!isAdminConfigured()) return { calls: [] };
  const db = getAdminDb();
  let query: FirebaseFirestore.Query = db.collection("calls");
  if (args.leadId) query = query.where("leadId", "==", args.leadId);
  if (args.outcome) query = query.where("outcome", "==", args.outcome);
  query = query.orderBy("createdAt", "desc").limit(args.limit ?? 20);
  const snap = await query.get();
  return { calls: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
}

export async function handleBusinessReadQuotes(_ctx: OptimusToolContext, args: { leadId?: string; status?: string; limit?: number }) {
  await middlewareCheck(_ctx, "AI", "business_read_quotes", 0);
  if (!isAdminConfigured()) return { quotes: [] };
  const db = getAdminDb();
  let query: FirebaseFirestore.Query = db.collection("quotes");
  if (args.leadId) query = query.where("leadId", "==", args.leadId);
  if (args.status) query = query.where("status", "==", args.status);
  query = query.orderBy("createdAt", "desc").limit(args.limit ?? 20);
  const snap = await query.get();
  return { quotes: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
}

export async function handleBusinessReadBookings(_ctx: OptimusToolContext, args: { leadId?: string; status?: string; limit?: number }) {
  await middlewareCheck(_ctx, "AI", "business_read_bookings", 0);
  if (!isAdminConfigured()) return { bookings: [] };
  const db = getAdminDb();
  let query: FirebaseFirestore.Query = db.collection("bookings");
  if (args.leadId) query = query.where("leadId", "==", args.leadId);
  if (args.status) query = query.where("status", "==", args.status);
  query = query.orderBy("createdAt", "desc").limit(args.limit ?? 20);
  const snap = await query.get();
  return { bookings: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
}

export async function handleBusinessReadAnalytics(_ctx: OptimusToolContext, args: { rangeDays?: number }) {
  await middlewareCheck(_ctx, "AI", "business_read_analytics", 0);
  const summary = await getTileSummary(args.rangeDays ?? 30);
  return { summary };
}

// Business Write handlers (Low Risk)
export async function handleBusinessCreateLead(ctx: OptimusToolContext, args: { firstName?: string; lastName?: string; email?: string; phoneE164?: string; company?: string; source: string; servicesInterested?: string[] }) {
  await middlewareCheck(ctx, "AI", "business_create_lead", 0);
  const result = await findOrCreateLead(ctx.actor, {
    firstName: args.firstName,
    lastName: args.lastName,
    email: args.email,
    phoneE164: args.phoneE164,
    company: args.company,
    source: args.source as any,
    servicesInterested: args.servicesInterested as ServiceInterest[],
  });
  if (!result) throw new Error("Failed to create lead");
  return { leadId: result.id, created: result.created };
}

export async function handleBusinessUpdateLead(_ctx: OptimusToolContext, args: { leadId: string; status?: string; temperature?: number; nextAction?: string; nextActionAt?: number; aiSummary?: string; notes?: string; tags?: string[] }) {
  await middlewareCheck(_ctx, "AI", "business_update_lead", 0, args.leadId as LeadId);
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

export async function handleBusinessCreateQuote(_ctx: OptimusToolContext, args: { leadId: string; items: Array<{ label: string; description?: string; quantity: number; unitRangeLowCents: number; unitRangeHighCents: number; currency: "ZAR" | "USD" }>; note?: string; rangeLowCents: number; rangeHighCents: number; currency: "ZAR" | "USD" }) {
  await middlewareCheck(_ctx, "AI", "business_create_quote", 0, args.leadId as LeadId);
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
    createdBy: "OPTIMUS" as const,
    viewedAt: null,
    sentAt: null,
    acceptedAt: null,
    wonAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection("quotes").doc(quoteId).create(quote);
  await appendInteraction(
    _ctx.actor,
    args.leadId as LeadId,
    { type: "quote_created", quoteId: quoteId as any, summary: `Quote created: ${quote.title}`, at: now, data: { rangeLow: args.rangeLowCents, rangeHigh: args.rangeHighCents } },
    { silentAudit: true }
  );
  return { quoteId, status: "DRAFT" };
}

export async function handleBusinessCreateBooking(_ctx: OptimusToolContext, args: { leadId: string; type: "CALLBACK" | "VIDEO" | "IN_PERSON"; startsAt: number; durationMin: number; mediumUrl?: string; notes?: string }) {
  await middlewareCheck(_ctx, "AI", "business_create_booking", 0, args.leadId as LeadId);
  if (!isAdminConfigured()) throw new Error("Firebase Admin not configured");
  const db = getAdminDb();
  const bookingId = `booking_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const booking = {
    id: bookingId,
    leadId: args.leadId,
    type: args.type,
    status: "PENDING",
    title: `${args.type} booking`,
    startAt: args.startsAt,
    durationMinutes: args.durationMin,
    timezoneIana: "Africa/Johannesburg",
    attendees: [{ name: "Tebogo", kind: "TEBOGO" as const }],
    videoMeetingUrl: args.mediumUrl ?? null,
    phoneCallNumber: null,
    location: null,
    notes: args.notes ?? null,
    source: "LEAD_AI",
    createdBy: "OPTIMUS" as const,
    cancelledReason: null,
    noShowReason: null,
    completedNotes: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection("bookings").doc(bookingId).create(booking);
  return { bookingId, status: "PENDING" };
}

// External Communication handlers
export async function handleBusinessSendEmail(ctx: OptimusToolContext, args: { leadId: string; subject: string; html?: string; text?: string; requiresApproval?: boolean }) {
  const requiresApproval = args.requiresApproval !== false;
  if (requiresApproval) {
    return { requiresApproval: true, message: "Email prepared for approval. Use 'Do it' to send after review." };
  }
  await middlewareCheck(ctx, "EMAIL", "business_send_email", 0.001, args.leadId as LeadId);
  if (!isAdminConfigured()) throw new Error("Firebase Admin not configured");
  const db = getAdminDb();
  const leadSnap = await db.collection("leads").doc(args.leadId).get();
  if (!leadSnap.exists) throw new Error("Lead not found");
  const lead = leadSnap.data() as any;
  const result = await sendLeadEmail({
    actor: ctx.actor,
    origin: "AI",
    leadId: args.leadId as LeadId,
    toEmail: lead.email,
    toName: lead.fullName,
    subject: args.subject,
    html: args.html,
    text: args.text,
  });
  if (!result.ok) throw new Error(result.error);
  return { emailId: result.emailId, sent: true };
}

export async function handleBusinessPrepareEmail(_ctx: OptimusToolContext, args: { leadId: string; subject: string; html?: string; text?: string }) {
  await middlewareCheck(_ctx, "AI", "business_prepare_email", 0, args.leadId as LeadId);
  return { prepared: true, subject: args.subject, preview: args.text ?? args.html?.slice(0, 200) };
}

export async function handleBusinessSendWhatsApp(ctx: OptimusToolContext, args: { leadId: string; text: string; requiresApproval?: boolean }) {
  const requiresApproval = args.requiresApproval !== false;
  if (requiresApproval) {
    return { requiresApproval: true, message: "WhatsApp prepared for approval. Use 'Do it' to send after review." };
  }
  await middlewareCheck(ctx, "WHATSAPP", "business_send_whatsapp", 0.001, args.leadId as LeadId);
  // TODO: Implement actual WhatsApp send
  return { sent: true, message: "WhatsApp provider not configured" };
}

export async function handleBusinessPrepareWhatsApp(_ctx: OptimusToolContext, args: { leadId: string; text: string }) {
  await middlewareCheck(_ctx, "AI", "business_prepare_whatsapp", 0, args.leadId as LeadId);
  return { prepared: true, preview: args.text.slice(0, 200) };
}

// Scheduling handlers
export async function handleScheduleGetAvailability(_ctx: OptimusToolContext, args: { windowStart: number; windowEnd: number }) {
  await middlewareCheck(_ctx, "AI", "schedule_get_availability", 0);
  if (!isAdminConfigured()) return { slots: [] };
  const db = getAdminDb();
  const snap = await db.collection("tebogo_availability").where("enabled", "==", true).get();
  const slots: Array<{ available: boolean; start: number; end: number; dayOfWeek: number }> = [];
  for (const doc of snap.docs) {
    const rule = doc.data() as any;
    // Check if rule overlaps with window
    const ruleStart = new Date(args.windowStart);
    ruleStart.setUTCHours(0, 0, 0, 0);
    ruleStart.setUTCDate(ruleStart.getUTCDate() + ((rule.dayOfWeek - ruleStart.getUTCDay() + 7) % 7));
    ruleStart.setUTCMinutes(rule.startUtcMin);
    const ruleEnd = new Date(ruleStart);
    ruleEnd.setUTCMinutes(rule.endUtcMin);
    if (ruleStart.getTime() < args.windowEnd && ruleEnd.getTime() > args.windowStart) {
      slots.push({ available: true, start: Math.max(args.windowStart, ruleStart.getTime()), end: Math.min(args.windowEnd, ruleEnd.getTime()), dayOfWeek: rule.dayOfWeek });
    }
  }
  return { slots };
}

export async function handleScheduleCreateBooking(_ctx: OptimusToolContext, args: { leadId: string; type: "CALLBACK" | "VIDEO" | "IN_PERSON"; startsAt: number; durationMin: number; notes?: string }) {
  await middlewareCheck(_ctx, "AI", "schedule_create_booking", 0, args.leadId as LeadId);
  if (!isAdminConfigured()) throw new Error("Firebase Admin not configured");
  const db = getAdminDb();
  const bookingId = `booking_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  const booking = {
    id: bookingId,
    leadId: args.leadId,
    type: args.type,
    status: "CONFIRMED",
    title: `${args.type} with Tebogo`,
    startAt: args.startsAt,
    durationMinutes: args.durationMin,
    timezoneIana: "Africa/Johannesburg",
    attendees: [{ name: "Tebogo", kind: "TEBOGO" as const }],
    videoMeetingUrl: args.type === "VIDEO" ? `https://meet.demitech.com/${bookingId}` : null,
    phoneCallNumber: args.type === "CALLBACK" ? process.env.TEBOGO_PHONE_E164 ?? null : null,
    location: args.type === "IN_PERSON" ? "DemiTech Office" : null,
    notes: args.notes ?? null,
    source: "LEAD_AI",
    createdBy: "OPTIMUS" as const,
    cancelledReason: null,
    noShowReason: null,
    completedNotes: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection("bookings").doc(bookingId).create(booking);
  return { bookingId, status: "CONFIRMED" };
}

// Research handlers (Stubs - require external API integrations)
export async function handleResearchCompanies(_ctx: OptimusToolContext, args: { query: string; location?: string; industry?: string; count?: number }) {
  await middlewareCheck(_ctx, "AI", "research_companies", 0);
  // Stub - requires external search API integration
  return {
    companies: [],
    message: "Research tool requires external search API integration (Google Custom Search, SerpAPI, etc.). Set RESEARCH_API_KEY env var.",
    query: args.query,
    location: args.location,
    industry: args.industry,
  };
}

export async function handleResearchAuditWebsite(_ctx: OptimusToolContext, args: { url: string }) {
  await middlewareCheck(_ctx, "AI", "research_audit_website", 0);
  // Stub - requires website fetching/analysis
  return {
    url: args.url,
    audit: {
      hasWebsite: false,
      issues: ["Research tool requires web fetching integration"],
      opportunities: [],
    },
    message: "Website audit requires web fetching/analysis integration (Puppeteer, Playwright, etc.).",
  };
}

export async function handleResearchCreateLeadsFromProspects(ctx: OptimusToolContext, args: { prospects: Array<{ companyName: string; website?: string; email?: string; phone?: string; address?: string; source?: string; notes?: string }> }) {
  await middlewareCheck(ctx, "AI", "research_create_leads_from_prospects", 0);
  const results = [];
  for (const p of args.prospects) {
    if (!p.email && !p.phone) continue;
    const result = await findOrCreateLead(ctx.actor, {
      firstName: p.companyName.split(" ")[0],
      lastName: p.companyName.split(" ").slice(1).join(" "),
      company: p.companyName,
      email: p.email,
      phoneE164: p.phone,
      source: "OTHER",
      servicesInterested: [],
    });
    if (result) results.push({ leadId: result.id, companyName: p.companyName, created: result.created });
  }
  return { created: results.length, leads: results };
}

// Activity log handlers
export async function handleActivityLog(ctx: OptimusToolContext, args: { type: string; summary: string; detail?: Record<string, unknown>; relatedEntityType?: string; relatedEntityId?: string }) {
  await middlewareCheck(ctx, "AI", "activity_log", 0);
  await logOptimusActivity({
    userId: ctx.userId,
    type: args.type as any,
    summary: args.summary,
    detail: args.detail,
    relatedEntityType: args.relatedEntityType,
    relatedEntityId: args.relatedEntityId,
  });
  return { logged: true };
}

export async function handleActivityGetLog(_ctx: OptimusToolContext, args: { limit?: number }) {
  await middlewareCheck(_ctx, "AI", "activity_get_log", 0);
  const log = await getOptimusActivityLog(_ctx.userId, args.limit ?? 50);
  return { activities: log.map((a) => ({ id: a.id, type: a.type, summary: a.summary, timestamp: a.timestamp, detail: a.detail })) };
}

export const OPTIMUS_TOOL_HANDLERS: Record<string, (ctx: OptimusToolContext, args: any) => Promise<any>> = {
  memory_get: handleMemoryGet,
  memory_set: handleMemorySet,
  memory_delete: handleMemoryDelete,
  goals_list: handleGoalsList,
  goals_create: handleGoalsCreate,
  goals_update: handleGoalsUpdate,
  goals_delete: handleGoalsDelete,
  projects_list: handleProjectsList,
  projects_create: handleProjectsCreate,
  projects_update: handleProjectsUpdate,
  tasks_list: handleTasksList,
  tasks_create: handleTasksCreate,
  tasks_update: handleTasksUpdate,
  tasks_complete: handleTasksComplete,
  reminders_list: handleRemindersList,
  reminders_create: handleRemindersCreate,
  reminders_update: handleRemindersUpdate,
  decisions_list: handleDecisionsList,
  decisions_create: handleDecisionsCreate,
  lessons_list: handleLessonsList,
  lessons_create: handleLessonsCreate,
  plans_list: handlePlansList,
  plans_create: handlePlansCreate,
  plans_update: handlePlansUpdate,
  business_read_leads: handleBusinessReadLeads,
  business_read_conversations: handleBusinessReadConversations,
  business_read_emails: handleBusinessReadEmails,
  business_read_calls: handleBusinessReadCalls,
  business_read_quotes: handleBusinessReadQuotes,
  business_read_bookings: handleBusinessReadBookings,
  business_read_analytics: handleBusinessReadAnalytics,
  business_create_lead: handleBusinessCreateLead,
  business_update_lead: handleBusinessUpdateLead,
  business_create_quote: handleBusinessCreateQuote,
  business_create_booking: handleBusinessCreateBooking,
  business_send_email: handleBusinessSendEmail,
  business_prepare_email: handleBusinessPrepareEmail,
  business_send_whatsapp: handleBusinessSendWhatsApp,
  business_prepare_whatsapp: handleBusinessPrepareWhatsApp,
  schedule_get_availability: handleScheduleGetAvailability,
  schedule_create_booking: handleScheduleCreateBooking,
  research_companies: handleResearchCompanies,
  research_audit_website: handleResearchAuditWebsite,
  research_create_leads_from_prospects: handleResearchCreateLeadsFromProspects,
  activity_log: handleActivityLog,
  activity_get_log: handleActivityGetLog,
};