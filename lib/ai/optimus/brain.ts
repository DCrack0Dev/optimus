import { getAdminDb, isAdminConfigured } from "@optimus/lib/firebase/admin";
import type {
  OptimusConversation,
  OptimusConversationMessage,
  OptimusMemory,
  OptimusGoal,
  OptimusProject,
  OptimusTask,
  OptimusReminder,
  OptimusDecision,
  OptimusLesson,
  OptimusPlan,
  OptimusActivityLogEntry,
  Uid,
  RecurrenceRule,
} from "@shared/types";
import { getLLMProvider } from "@optimus/lib/providers";
import { OPTIMUS_TOOL_DEFINITIONS, type OptimusToolName } from "./tools/schemas";
import { OPTIMUS_TOOL_HANDLERS } from "./tools/handlers";
import { OPTIMUS_SYSTEM_PROMPT } from "./system-prompt";
import { writeAudit } from "@optimus/lib/audit/writer";

const MAX_TURNS = 8;

export interface RunOptimusTurnInput {
  conversationId?: string;
  userId: Uid;
  initialMessage?: string;
  maxTurns?: number;
  voiceMode?: boolean;
}

export interface RunOptimusTurnResult {
  reply: string;
  toolCalls: Array<{ tool: string; args: unknown; result: unknown; ok: boolean }>;
  conversationId: string;
}

function conversationId(): string {
  return `optimus_conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function messageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

async function getOrCreateConversation(
  conversationIdParam: string | undefined,
  userId: Uid
): Promise<{ conversation: OptimusConversation; isNew: boolean }> {
  if (!isAdminConfigured()) throw new Error("Firebase Admin not configured");
  const db = getAdminDb();

  if (conversationIdParam) {
    const snap = await db.collection("optimus_conversations").doc(conversationIdParam).get();
    if (snap.exists) {
      const conv = snap.data() as OptimusConversation;
      if (conv.userId === userId) {
        return { conversation: conv, isNew: false };
      }
    }
  }

  const id = conversationId();
  const now = Date.now();
  const conversation: OptimusConversation = {
    id,
    userId,
    messages: [],
    activePlanId: undefined,
    activeProjectId: undefined,
    context: {},
    createdAt: now,
    updatedAt: now,
  };

  await db.collection("optimus_conversations").doc(id).create(conversation);
  return { conversation, isNew: true };
}

async function saveConversation(conversation: OptimusConversation): Promise<void> {
  if (!isAdminConfigured()) return;
  const db = getAdminDb();
  conversation.updatedAt = Date.now();
  await db.collection("optimus_conversations").doc(conversation.id).set(conversation, { merge: false });
}

async function saveOptimusAction(
  conversationId: string,
  userId: Uid,
  toolName: string,
  args: Record<string, unknown>,
  result: unknown,
  ok: boolean,
  turnIndex: number
): Promise<string> {
  if (!isAdminConfigured()) return `action_${Date.now()}`;
  const db = getAdminDb();
  const actionId = `optimus_action_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const action = {
    id: actionId,
    conversationId,
    userId,
    toolName,
    args,
    result: result as Record<string, unknown> | null,
    ok,
    turnIndex,
    createdAt: Date.now(),
  };
  await db.collection("optimus_actions").doc(actionId).create(action);
  return actionId;
}

export async function runOptimusTurn(input: RunOptimusTurnInput): Promise<RunOptimusTurnResult> {
  const provider = getLLMProvider();
  if (!provider) throw new Error("LLM provider not configured");

  const { conversation, isNew } = await getOrCreateConversation(input.conversationId, input.userId);
  const actor = { uid: "OPTIMUS" as Uid, role: null };

  const systemPrompt = input.voiceMode ? OPTIMUS_SYSTEM_PROMPT + "\n\nVOICE MODE: Keep responses concise (2-3 sentences). Use natural, conversational language." : OPTIMUS_SYSTEM_PROMPT;

  const messages: OptimusConversationMessage[] = [
    {
      id: messageId(),
      role: "system",
      content: systemPrompt,
      createdAt: Date.now(),
    },
    ...conversation.messages,
  ];

  if (input.initialMessage && isNew) {
    messages.push({
      id: messageId(),
      role: "user",
      content: input.initialMessage,
      createdAt: Date.now(),
    });
  }

  const toolResults: RunOptimusTurnResult["toolCalls"] = [];
  let turnCount = 0;
  const maxTurns = input.maxTurns ?? MAX_TURNS;

  while (turnCount < maxTurns) {
    turnCount++;

    const response = await provider.createChatCompletion({
      messages: messages as any,
      tools: OPTIMUS_TOOL_DEFINITIONS as any,
      toolChoice: "auto",
      temperature: 0.3,
      maxTokens: 3000,
    });

    const assistantMsg: OptimusConversationMessage = {
      id: messageId(),
      role: "assistant",
      content: response.content,
      toolCallId: response.toolCalls?.[0]?.id,
      toolName: response.toolCalls?.[0]?.function.name,
      toolArgs: response.toolCalls?.[0] ? JSON.parse(response.toolCalls[0].function.arguments) : undefined,
      createdAt: Date.now(),
    };
    messages.push(assistantMsg);

    if (!response.toolCalls || response.toolCalls.length === 0) {
      break;
    }

    for (const tc of response.toolCalls) {
      const toolName = tc.function.name as OptimusToolName;
      const handler = OPTIMUS_TOOL_HANDLERS[toolName];
      let toolResult: unknown;
      let ok = true;

      try {
        const args = JSON.parse(tc.function.arguments);
        if (handler) {
          toolResult = await handler(
            { actor, conversationId: conversation.id, userId: input.userId },
            args
          );
        } else {
          toolResult = { error: `Unknown tool: ${toolName}` };
          ok = false;
        }
      } catch (err) {
        toolResult = { error: err instanceof Error ? err.message : String(err) };
        ok = false;
      }

      await saveOptimusAction(
        conversation.id,
        input.userId,
        toolName,
        JSON.parse(tc.function.arguments),
        toolResult,
        ok,
        turnCount
      );

      toolResults.push({ tool: toolName, args: JSON.parse(tc.function.arguments), result: toolResult, ok });

      messages.push({
        id: messageId(),
        role: "tool",
        content: JSON.stringify(toolResult),
        toolCallId: tc.id,
        toolName: toolName,
        toolArgs: undefined,
        createdAt: Date.now(),
      });

      if (!ok) {
        await writeAudit({
          actorUid: "OPTIMUS",
          event: "AI_TOOL_CALL",
          detail: `Optimus tool ${toolName} failed: ${JSON.stringify(toolResult)}`,
          aiConversationId: conversation.id,
          data: { tool: toolName, error: toolResult },
        });
      }
    }
  }

  const finalMessage = messages.filter((m) => m.role === "assistant").pop();
  let reply = finalMessage?.content ?? "I've processed your request.";

  conversation.messages = messages.slice(1);
  conversation.updatedAt = Date.now();

  await saveConversation(conversation);

  if (input.userId) {
    await writeAudit({
      actorUid: "OPTIMUS",
      event: "AI_TOOL_CALL",
      detail: `Optimus turn completed for user ${input.userId}`,
      data: { toolCalls: toolResults.length, turns: turnCount },
    });
  }

  return { reply, toolCalls: toolResults, conversationId: conversation.id };
}

// Memory operations
export async function getOptimusMemory(userId: Uid, category?: string): Promise<OptimusMemory[]> {
  if (!isAdminConfigured()) return [];
  const db = getAdminDb();
  let query: FirebaseFirestore.Query = db.collection("optimus_memory").where("userId", "==", userId);
  if (category) query = query.where("category", "==", category);
  query = query.orderBy("updatedAt", "desc");
  const snap = await query.get();
  return snap.docs.map((d) => ({ ...(d.data() as OptimusMemory), id: d.id }));
}

export async function setOptimusMemory(
  userId: Uid,
  category: OptimusMemory["category"],
  key: string,
  value: unknown,
  metadata?: Record<string, unknown>
): Promise<OptimusMemory> {
  if (!isAdminConfigured()) throw new Error("Firebase Admin not configured");
  const db = getAdminDb();
  const now = Date.now();
  const existing = await db
    .collection("optimus_memory")
    .where("userId", "==", userId)
    .where("category", "==", category)
    .where("key", "==", key)
    .limit(1)
    .get();

  let id: string;
  if (!existing.empty) {
    const doc = existing.docs[0];
    if (!doc) throw new Error("Unexpected empty doc");
    id = doc.id;
    await db.collection("optimus_memory").doc(id).update({ value, metadata, updatedAt: now });
  } else {
    id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db.collection("optimus_memory").doc(id).create({
      id,
      userId,
      category,
      key,
      value,
      metadata: metadata ?? undefined,
      createdAt: now,
      updatedAt: now,
    });
  }
  return { id, userId, category, key, value, metadata, createdAt: now, updatedAt: now };
}

export async function deleteOptimusMemory(userId: Uid, id: string): Promise<void> {
  if (!isAdminConfigured()) return;
  const db = getAdminDb();
  const snap = await db.collection("optimus_memory").doc(id).get();
  if (snap.exists) {
    const data = snap.data() as OptimusMemory;
    if (data.userId === userId) {
      await db.collection("optimus_memory").doc(id).delete();
    }
  }
}

// Goals
export async function getOptimusGoals(userId: Uid): Promise<OptimusGoal[]> {
  if (!isAdminConfigured()) return [];
  const db = getAdminDb();
  const snap = await db.collection("optimus_goals").where("userId", "==", userId).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ ...(d.data() as OptimusGoal), id: d.id }));
}

export async function createOptimusGoal(userId: Uid, goal: Omit<OptimusGoal, "id" | "userId" | "createdAt" | "updatedAt"> & { status?: OptimusGoal["status"]; projectIds?: OptimusGoal["projectIds"] }): Promise<OptimusGoal> {
  if (!isAdminConfigured()) throw new Error("Firebase Admin not configured");
  const db = getAdminDb();
  const now = Date.now();
  const id = `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const newGoal: OptimusGoal = { 
    ...goal, 
    id, 
    userId, 
    createdAt: now, 
    updatedAt: now,
    status: goal.status ?? "active",
    projectIds: goal.projectIds ?? [],
  };
  await db.collection("optimus_goals").doc(id).create(newGoal);
  return newGoal;
}

export async function updateOptimusGoal(userId: Uid, id: string, patch: Partial<OptimusGoal>): Promise<OptimusGoal | null> {
  if (!isAdminConfigured()) return null;
  const db = getAdminDb();
  const ref = db.collection("optimus_goals").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as OptimusGoal;
  if (data.userId !== userId) return null;
  const updated = { ...data, ...patch, updatedAt: Date.now() };
  await ref.set(updated, { merge: true });
  return updated;
}

export async function deleteOptimusGoal(userId: Uid, id: string): Promise<void> {
  if (!isAdminConfigured()) return;
  const db = getAdminDb();
  const snap = await db.collection("optimus_goals").doc(id).get();
  if (snap.exists) {
    const data = snap.data() as OptimusGoal;
    if (data.userId === userId) {
      await db.collection("optimus_goals").doc(id).delete();
    }
  }
}

// Projects
export async function getOptimusProjects(userId: Uid): Promise<OptimusProject[]> {
  if (!isAdminConfigured()) return [];
  const db = getAdminDb();
  const snap = await db.collection("optimus_projects").where("userId", "==", userId).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ ...(d.data() as OptimusProject), id: d.id }));
}

export async function createOptimusProject(userId: Uid, project: Omit<OptimusProject, "id" | "userId" | "createdAt" | "updatedAt">): Promise<OptimusProject> {
  if (!isAdminConfigured()) throw new Error("Firebase Admin not configured");
  const db = getAdminDb();
  const now = Date.now();
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const newProject: OptimusProject = { ...project, id, userId, createdAt: now, updatedAt: now };
  await db.collection("optimus_projects").doc(id).create(newProject);
  return newProject;
}

export async function updateOptimusProject(userId: Uid, id: string, patch: Partial<OptimusProject>): Promise<OptimusProject | null> {
  if (!isAdminConfigured()) return null;
  const db = getAdminDb();
  const ref = db.collection("optimus_projects").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as OptimusProject;
  if (data.userId !== userId) return null;
  const updated = { ...data, ...patch, updatedAt: Date.now() };
  await ref.set(updated, { merge: true });
  return updated;
}

// Tasks
export async function getOptimusTasks(userId: Uid, projectId?: string): Promise<OptimusTask[]> {
  if (!isAdminConfigured()) return [];
  const db = getAdminDb();
  let query: FirebaseFirestore.Query = db.collection("optimus_tasks").where("userId", "==", userId);
  if (projectId) query = query.where("projectId", "==", projectId);
  query = query.orderBy("createdAt", "desc");
  const snap = await query.get();
  return snap.docs.map((d) => ({ ...(d.data() as OptimusTask), id: d.id }));
}

export async function createOptimusTask(userId: Uid, task: Omit<OptimusTask, "id" | "userId" | "createdAt" | "updatedAt"> & { status?: OptimusTask["status"]; priority?: OptimusTask["priority"]; tags?: OptimusTask["tags"]; dependencies?: OptimusTask["dependencies"] }): Promise<OptimusTask> {
  if (!isAdminConfigured()) throw new Error("Firebase Admin not configured");
  const db = getAdminDb();
  const now = Date.now();
  const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const newTask: OptimusTask = { 
    ...task, 
    id, 
    userId, 
    createdAt: now, 
    updatedAt: now,
    status: task.status ?? "backlog",
    priority: task.priority ?? "medium",
    tags: task.tags ?? [],
    dependencies: task.dependencies ?? [],
  };
  await db.collection("optimus_tasks").doc(id).create(newTask);
  return newTask;
}

export async function updateOptimusTask(userId: Uid, id: string, patch: Partial<OptimusTask>): Promise<OptimusTask | null> {
  if (!isAdminConfigured()) return null;
  const db = getAdminDb();
  const ref = db.collection("optimus_tasks").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as OptimusTask;
  if (data.userId !== userId) return null;
  const updated = { ...data, ...patch, updatedAt: Date.now() };
  await ref.set(updated, { merge: true });
  return updated;
}

export async function completeOptimusTask(userId: Uid, id: string): Promise<OptimusTask | null> {
  return updateOptimusTask(userId, id, { status: "done", completedAt: Date.now() });
}

// Reminders
export async function getOptimusReminders(userId: Uid): Promise<OptimusReminder[]> {
  if (!isAdminConfigured()) return [];
  const db = getAdminDb();
  const snap = await db.collection("optimus_reminders").where("userId", "==", userId).orderBy("dueAt", "asc").get();
  return snap.docs.map((d) => ({ ...(d.data() as OptimusReminder), id: d.id }));
}

export async function createOptimusReminder(userId: Uid, reminder: Omit<OptimusReminder, "id" | "userId" | "createdAt" | "updatedAt"> & { status?: OptimusReminder["status"]; notificationChannels?: OptimusReminder["notificationChannels"] }): Promise<OptimusReminder> {
  if (!isAdminConfigured()) throw new Error("Firebase Admin not configured");
  const db = getAdminDb();
  const now = Date.now();
  const id = `rem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const newReminder: OptimusReminder = { 
    ...reminder, 
    id, 
    userId, 
    createdAt: now, 
    updatedAt: now,
    status: reminder.status ?? "pending",
    notificationChannels: reminder.notificationChannels ?? ["dashboard"],
  };
  await db.collection("optimus_reminders").doc(id).create(newReminder);
  return newReminder;
}

// Decisions
export async function getOptimusDecisions(userId: Uid): Promise<OptimusDecision[]> {
  if (!isAdminConfigured()) return [];
  const db = getAdminDb();
  const snap = await db.collection("optimus_decisions").where("userId", "==", userId).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ ...(d.data() as OptimusDecision), id: d.id }));
}

export async function createOptimusDecision(userId: Uid, decision: Omit<OptimusDecision, "id" | "userId" | "createdAt">): Promise<OptimusDecision> {
  if (!isAdminConfigured()) throw new Error("Firebase Admin not configured");
  const db = getAdminDb();
  const now = Date.now();
  const id = `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const newDecision: OptimusDecision = { ...decision, id, userId, createdAt: now };
  await db.collection("optimus_decisions").doc(id).create(newDecision);
  return newDecision;
}

// Lessons (Learning)
export async function getOptimusLessons(userId: Uid): Promise<OptimusLesson[]> {
  if (!isAdminConfigured()) return [];
  const db = getAdminDb();
  const snap = await db.collection("optimus_lessons").where("userId", "==", userId).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ ...(d.data() as OptimusLesson), id: d.id }));
}

export async function createOptimusLesson(userId: Uid, lesson: Omit<OptimusLesson, "id" | "userId" | "createdAt">): Promise<OptimusLesson> {
  if (!isAdminConfigured()) throw new Error("Firebase Admin not configured");
  const db = getAdminDb();
  const now = Date.now();
  const id = `lesson_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const newLesson: OptimusLesson = { ...lesson, id, userId, createdAt: now };
  await db.collection("optimus_lessons").doc(id).create(newLesson);
  return newLesson;
}

// Plans
export async function getOptimusPlans(userId: Uid): Promise<OptimusPlan[]> {
  if (!isAdminConfigured()) return [];
  const db = getAdminDb();
  const snap = await db.collection("optimus_plans").where("userId", "==", userId).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ ...(d.data() as OptimusPlan), id: d.id }));
}

export async function createOptimusPlan(userId: Uid, plan: Omit<OptimusPlan, "id" | "userId" | "createdAt" | "updatedAt">): Promise<OptimusPlan> {
  if (!isAdminConfigured()) throw new Error("Firebase Admin not configured");
  const db = getAdminDb();
  const now = Date.now();
  const id = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const newPlan: OptimusPlan = { ...plan, id, userId, createdAt: now, updatedAt: now };
  await db.collection("optimus_plans").doc(id).create(newPlan);
  return newPlan;
}

export async function updateOptimusPlan(userId: Uid, id: string, patch: Partial<OptimusPlan>): Promise<OptimusPlan | null> {
  if (!isAdminConfigured()) return null;
  const db = getAdminDb();
  const ref = db.collection("optimus_plans").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as OptimusPlan;
  if (data.userId !== userId) return null;
  const updated = { ...data, ...patch, updatedAt: Date.now() };
  await ref.set(updated, { merge: true });
  return updated;
}

// Activity Log
export async function logOptimusActivity(entry: Omit<OptimusActivityLogEntry, "id" | "timestamp">): Promise<void> {
  if (!isAdminConfigured()) return;
  const db = getAdminDb();
  const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await db.collection("optimus_activity_log").doc(id).create({
    id,
    ...entry,
    timestamp: Date.now(),
  });
}

export async function getOptimusActivityLog(userId: Uid, limit = 100): Promise<OptimusActivityLogEntry[]> {
  if (!isAdminConfigured()) return [];
  const db = getAdminDb();
  const snap = await db.collection("optimus_activity_log").where("userId", "==", userId).orderBy("timestamp", "desc").limit(limit).get();
  return snap.docs.map((d) => ({ ...(d.data() as OptimusActivityLogEntry), id: d.id }));
}

// Scheduled Automations
export interface ScheduledAutomation {
  id: string;
  userId: Uid;
  name: string;
  description: string;
  trigger: "cron" | "interval" | "date";
  cronExpression?: string;
  intervalMs?: number;
  runAt?: number;
  action: {
    type: "run_optimus_turn" | "send_report" | "run_research" | "run_custom";
    payload: Record<string, unknown>;
  };
  enabled: boolean;
  lastRunAt?: number;
  nextRunAt?: number;
  createdAt: number;
  updatedAt: number;
}

export async function getOptimusAutomations(userId: Uid): Promise<ScheduledAutomation[]> {
  if (!isAdminConfigured()) return [];
  const db = getAdminDb();
  const snap = await db.collection("optimus_automations").where("userId", "==", userId).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ ...(d.data() as ScheduledAutomation), id: d.id }));
}

export async function createOptimusAutomation(userId: Uid, automation: Omit<ScheduledAutomation, "id" | "userId" | "createdAt" | "updatedAt">): Promise<ScheduledAutomation> {
  if (!isAdminConfigured()) throw new Error("Firebase Admin not configured");
  const db = getAdminDb();
  const now = Date.now();
  const id = `auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const newAuto: ScheduledAutomation = { ...automation, id, userId, createdAt: now, updatedAt: now };
  await db.collection("optimus_automations").doc(id).create(newAuto);
  return newAuto;
}

export async function updateOptimusAutomation(userId: Uid, id: string, patch: Partial<ScheduledAutomation>): Promise<ScheduledAutomation | null> {
  if (!isAdminConfigured()) return null;
  const db = getAdminDb();
  const ref = db.collection("optimus_automations").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as ScheduledAutomation;
  if (data.userId !== userId) return null;
  const updated = { ...data, ...patch, updatedAt: Date.now() };
  await ref.set(updated, { merge: true });
  return updated;
}

export async function deleteOptimusAutomation(userId: Uid, id: string): Promise<void> {
  if (!isAdminConfigured()) return;
  const db = getAdminDb();
  const snap = await db.collection("optimus_automations").doc(id).get();
  if (snap.exists) {
    const data = snap.data() as ScheduledAutomation;
    if (data.userId === userId) {
      await db.collection("optimus_automations").doc(id).delete();
    }
  }
}

export interface AutomationRunnerResult {
  automationsProcessed: number;
  remindersProcessed: number;
  followupsProcessed: number;
  errors: string[];
}

export async function runAutomationRunner(): Promise<AutomationRunnerResult> {
  if (!isAdminConfigured()) {
    return { automationsProcessed: 0, remindersProcessed: 0, followupsProcessed: 0, errors: ["Firebase Admin not configured"] };
  }

  const db = getAdminDb();
  const now = Date.now();
  const errors: string[] = [];
  let automationsProcessed = 0;
  let remindersProcessed = 0;
  let followupsProcessed = 0;

  try {
    const automationsSnap = await db
      .collection("optimus_automations")
      .where("enabled", "==", true)
      .where("nextRunAt", "<=", now)
      .limit(50)
      .get();

    for (const doc of automationsSnap.docs) {
      try {
        const automation = doc.data() as ScheduledAutomation;
        const automationId = doc.id;

        if (automation.action.type === "run_optimus_turn") {
          await runOptimusTurn({
            userId: automation.userId,
            initialMessage: automation.action.payload.message as string ?? "Run scheduled automation",
            maxTurns: 5,
          });
        } else if (automation.action.type === "send_report") {
          // Report generation would be implemented here
        } else if (automation.action.type === "run_research") {
          // Research execution would be implemented here
        }

        const nextRunAt = calculateNextRunAt(automation);
        await db.collection("optimus_automations").doc(automationId).update({
          lastRunAt: now,
          nextRunAt,
          updatedAt: now,
        });

        await logOptimusActivity({
          userId: automation.userId,
          type: "action_executed",
          summary: `Automation executed: ${automation.name}`,
          detail: { automationId, actionType: automation.action.type },
          relatedEntityType: "automation",
          relatedEntityId: automationId,
        });

        automationsProcessed++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Automation ${doc.id}: ${message}`);
      }
    }
  } catch (err) {
    errors.push(`Automation runner error: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const remindersSnap = await db
      .collection("optimus_reminders")
      .where("status", "==", "pending")
      .where("dueAt", "<=", now)
      .limit(100)
      .get();

    for (const doc of remindersSnap.docs) {
      try {
        const reminder = doc.data() as OptimusReminder;
        const reminderId = doc.id;

        await db.collection("optimus_reminders").doc(reminderId).update({
          status: "triggered",
          updatedAt: now,
        });

        if (reminder.recurrence) {
          const nextDueAt = calculateNextRecurrence(reminder.dueAt, reminder.recurrence);
          if (nextDueAt) {
            await db.collection("optimus_reminders").doc(reminderId).update({
              dueAt: nextDueAt,
              status: "pending",
              updatedAt: now,
            });
          } else {
            await db.collection("optimus_reminders").doc(reminderId).update({
              status: "completed",
              updatedAt: now,
            });
          }
        } else {
          await db.collection("optimus_reminders").doc(reminderId).update({
            status: "completed",
            updatedAt: now,
          });
        }

        await logOptimusActivity({
          userId: reminder.userId,
          type: "reminder_created",
          summary: `Reminder triggered: ${reminder.title}`,
          detail: { reminderId, dueAt: reminder.dueAt },
          relatedEntityType: "reminder",
          relatedEntityId: reminderId,
        });

        remindersProcessed++;
      } catch (err) {
        errors.push(`Reminder ${doc.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    errors.push(`Reminder runner error: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const followupsSnap = await db
      .collection("followups")
      .where("status", "in", ["PENDING", "SCHEDULED"])
      .where("scheduledAt", "<=", now)
      .limit(100)
      .get();

    for (const doc of followupsSnap.docs) {
      try {
        const followupId = doc.id;

        await db.collection("followups").doc(followupId).update({
          status: "EXECUTING",
          updatedAt: now,
        });

        // The actual execution would be handled by the followup service
        // Here we just mark it as executing - the actual channel handler should complete it

        followupsProcessed++;
      } catch (err) {
        errors.push(`Followup ${doc.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    errors.push(`Followup runner error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { automationsProcessed, remindersProcessed, followupsProcessed, errors };
}

function calculateNextRunAt(automation: ScheduledAutomation): number | undefined {
  if (automation.trigger === "cron" && automation.cronExpression) {
    return getNextCronRun(automation.cronExpression);
  }
  if (automation.trigger === "interval" && automation.intervalMs) {
    return Date.now() + automation.intervalMs;
  }
  if (automation.trigger === "date" && automation.runAt) {
    return undefined; // One-time automation
  }
  return undefined;
}

function calculateNextRecurrence(currentDueAt: number, recurrence: RecurrenceRule): number | null {
  const current = new Date(currentDueAt);
  switch (recurrence.frequency) {
    case "daily":
      current.setDate(current.getDate() + (recurrence.interval ?? 1));
      return current.getTime();
    case "weekly":
      current.setDate(current.getDate() + 7 * (recurrence.interval ?? 1));
      return current.getTime();
    case "monthly":
      current.setMonth(current.getMonth() + (recurrence.interval ?? 1));
      return current.getTime();
    case "yearly":
      current.setFullYear(current.getFullYear() + (recurrence.interval ?? 1));
      return current.getTime();
    default:
      return null;
  }
}

function getNextCronRun(_cronExpression: string): number {
  // Simplified cron parsing - in production use a proper cron library
  // For now, return next minute as placeholder
  return Date.now() + 60000;
}