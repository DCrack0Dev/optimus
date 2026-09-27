import { getAdminDb, isAdminConfigured } from "@optimus/lib/firebase/admin";
import type { AIQueueId, AIQueueItem, AIQueueStatus, LeadId, Uid } from "@shared/types";
import { writeAudit } from "@optimus/lib/audit/writer";

function queueId(): AIQueueId {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  ) as AIQueueId;
}

export interface EnqueueAgentTurnInput {
  leadId: LeadId;
  trigger: string;
  idempotencyKey?: string;
  payload: Record<string, unknown>;
  priority?: number;
}

export async function enqueueAgentTurn(input: EnqueueAgentTurnInput): Promise<AIQueueId | null> {
  if (!isAdminConfigured()) return null;
  const db = getAdminDb();
  const now = Date.now();
  const id = queueId();

  const item: AIQueueItem = {
    id,
    leadId: input.leadId,
    conversationId: null,
    trigger: input.trigger,
    idempotencyKey: input.idempotencyKey ?? null,
    status: "PENDING",
    retryCount: 0,
    nextRunAt: now,
    lastError: null,
    payload: input.payload,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };

  if (input.idempotencyKey) {
    const existing = await db
      .collection("ai_queue")
      .where("idempotencyKey", "==", input.idempotencyKey)
      .limit(1)
      .get();
    if (!existing.empty) {
      return existing.docs[0]!.id as AIQueueId;
    }
  }

  await db.collection("ai_queue").doc(id).create(item);
  return id;
}

export async function getPendingAgentTurns(limit = 10): Promise<AIQueueItem[]> {
  if (!isAdminConfigured()) return [];
  const db = getAdminDb();
  const now = Date.now();
  const snap = await db
    .collection("ai_queue")
    .where("status", "==", "PENDING")
    .where("nextRunAt", "<=", now)
    .orderBy("nextRunAt", "asc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ ...(d.data() as AIQueueItem), id: d.id as AIQueueId }));
}

export async function claimAgentTurn(
  queueId: AIQueueId,
  actor: { uid: Uid | "AI" | "SYSTEM" }
): Promise<AIQueueItem | null> {
  if (!isAdminConfigured()) return null;
  const db = getAdminDb();
  const ref = db.collection("ai_queue").doc(queueId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const item = snap.data() as AIQueueItem;
  if (item.status !== "PENDING") return null;

  await ref.update({
    status: "CLAIMED",
    updatedAt: Date.now(),
  });

  await writeAudit({
    actorUid: actor.uid,
    event: "AI_TOOL_CALL",
    detail: `claimed ai_queue ${queueId}`,
    aiQueueId: queueId,
    leadId: item.leadId,
    data: { queueId, trigger: item.trigger },
  });

  return { ...item, id: queueId, status: "CLAIMED" };
}

export async function completeAgentTurn(
  queueId: AIQueueId,
  actor: { uid: Uid | "AI" | "SYSTEM" },
  result: { ok: boolean; error?: string; conversationId?: string }
): Promise<void> {
  if (!isAdminConfigured()) return;
  const db = getAdminDb();
  const ref = db.collection("ai_queue").doc(queueId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const status: AIQueueStatus = result.ok ? "COMPLETED" : "FAILED";
  await ref.update({
    status,
    completedAt: Date.now(),
    updatedAt: Date.now(),
    lastError: result.error ?? null,
    conversationId: result.conversationId ?? null,
  });

  await writeAudit({
    actorUid: actor.uid,
    event: "AI_CONVERSATION_END",
    detail: `ai_queue ${queueId} ${status}`,
    aiQueueId: queueId,
    data: { ok: result.ok, error: result.error ?? null },
  });
}

export async function retryAgentTurn(
  queueId: AIQueueId,
  actor: { uid: Uid | "AI" | "SYSTEM" },
  error: string
): Promise<void> {
  if (!isAdminConfigured()) return;
  const db = getAdminDb();
  const ref = db.collection("ai_queue").doc(queueId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const item = snap.data() as AIQueueItem;
  const nextRetry = item.retryCount + 1;
  const backoffMs = Math.min(1000 * 60 * Math.pow(2, nextRetry), 1000 * 60 * 60);

  await ref.update({
    status: "PENDING",
    retryCount: nextRetry,
    nextRunAt: Date.now() + backoffMs,
    lastError: error,
    updatedAt: Date.now(),
  });

  await writeAudit({
    actorUid: actor.uid,
    event: "AI_TOOL_CALL",
    detail: `retry ai_queue ${queueId} attempt ${nextRetry}`,
    aiQueueId: queueId,
    leadId: item.leadId,
    data: { queueId, retryCount: nextRetry, error },
  });
}

export async function cancelAgentTurn(
  queueId: AIQueueId,
  actor: { uid: Uid | "AI" | "SYSTEM" },
  reason: string
): Promise<void> {
  if (!isAdminConfigured()) return;
  const db = getAdminDb();
  const ref = db.collection("ai_queue").doc(queueId);
  await ref.update({
    status: "CANCELLED_EMERGENCY_STOP",
    updatedAt: Date.now(),
    lastError: reason,
  });

  await writeAudit({
    actorUid: actor.uid,
    event: "EMERGENCY_STOP",
    detail: `cancelled ai_queue ${queueId}: ${reason}`,
    aiQueueId: queueId,
  });
}