import { getAdminDb, isAdminConfigured } from "@optimus/lib/firebase/admin";
import type { AIConversation, AIChatMessage, AIAction, LeadId, AIConversationId, AIActionId, Uid } from "@shared/types";
import type { LLMToolCall } from "@optimus/lib/providers/llm/types";
import { getLLMProvider } from "@optimus/lib/providers";
import { TOOL_DEFINITIONS, type ToolName } from "./tools/schemas";
import { TOOL_HANDLERS } from "./tools/handlers";
import { SYSTEM_PROMPT } from "./system-prompt";
import { stripExactProtectedValues, ensureRangeFormat } from "./strip-exact-prices";
import { writeAudit } from "@optimus/lib/audit/writer";

const MAX_TURNS = 6;

export interface RunAgentTurnInput {
  conversationId?: AIConversationId;
  leadId?: LeadId;
  trigger: string;
  initialMessage?: string;
  maxTurns?: number;
}

export interface RunAgentTurnResult {
  reply: string;
  toolCalls: Array<{ tool: string; args: unknown; result: unknown; ok: boolean }>;
  conversationId: AIConversationId;
}

async function getOrCreateConversation(
  input: RunAgentTurnInput
): Promise<{ conversation: AIConversation; isNew: boolean }> {
  if (!isAdminConfigured()) throw new Error("Firebase Admin not configured");
  const db = getAdminDb();

  if (input.conversationId) {
    const snap = await db.collection("ai_conversations").doc(input.conversationId).get();
    if (snap.exists) {
      return { conversation: snap.data() as AIConversation, isNew: false };
    }
  }

  const conversationId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` as AIConversationId;
  const now = Date.now();
  const conversation: AIConversation = {
    id: conversationId,
    leadId: input.leadId ?? null,
    channel: "DASHBOARD",
    refId: null,
    trigger: input.trigger,
    handoffRequested: false,
    handoffBookingId: null,
    summary: null,
    messages: [],
    model: process.env.LLM_MODEL ?? "llama-3.3-70b-versatile",
    promptTokens: 0,
    completionTokens: 0,
    toolCalls: 0,
    humanTurns: 0,
    customerTurns: 0,
    status: "ACTIVE",
    endedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection("ai_conversations").doc(conversationId).create(conversation);
  return { conversation, isNew: true };
}

async function saveConversation(conversation: AIConversation): Promise<void> {
  if (!isAdminConfigured()) return;
  const db = getAdminDb();
  await db.collection("ai_conversations").doc(conversation.id).set(conversation, { merge: false });
}

async function saveAIAction(
  conversationId: AIConversationId,
  leadId: LeadId | null,
  toolName: string,
  args: Record<string, unknown>,
  result: unknown,
  ok: boolean,
  turnIndex: number
): Promise<AIActionId> {
  if (!isAdminConfigured()) return `action_${Date.now()}` as AIActionId;
  const db = getAdminDb();
  const actionId = `action_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` as AIActionId;
  const action: AIAction = {
    id: actionId,
    conversationId,
    leadId,
    toolName,
    args,
    result: result as Record<string, unknown> | null,
    ok,
    deniedByMiddlewareCode: ok ? null : "middleware_denied",
    estimatedDollarCost: null,
    actualDollarCost: null,
    turnIndex,
    auditLogId: null,
    createdAt: Date.now(),
  };
  await db.collection("ai_actions").doc(actionId).create(action);
  return actionId;
}

export async function runAgentTurn(input: RunAgentTurnInput): Promise<RunAgentTurnResult> {
  const provider = getLLMProvider();
  if (!provider) throw new Error("LLM provider not configured");

  const { conversation, isNew } = await getOrCreateConversation(input);
  const actor = { uid: "AI" as Uid, role: null };

  const messages: AIChatMessage[] = [
    {
      id: `msg_${Date.now()}`,
      participant: { kind: "AI" },
      role: "system",
      content: SYSTEM_PROMPT,
      toolCallId: null,
      toolName: null,
      toolArgs: null,
      createdAt: Date.now(),
    },
    ...conversation.messages,
  ];

  if (input.initialMessage && isNew) {
    messages.push({
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      participant: { kind: "CUSTOMER" },
      role: "user",
      content: input.initialMessage,
      toolCallId: null,
      toolName: null,
      toolArgs: null,
      createdAt: Date.now(),
    });
  }

  const toolResults: RunAgentTurnResult["toolCalls"] = [];
  let turnCount = 0;
  const maxTurns = input.maxTurns ?? MAX_TURNS;

  let lastResponse: { usage?: { promptTokens: number; completionTokens: number }; toolCalls?: LLMToolCall[] | null } | null = null;

  while (turnCount < maxTurns) {
    turnCount++;

    const response = await provider.createChatCompletion({
      messages: messages as any,
      tools: TOOL_DEFINITIONS as any,
      toolChoice: "auto",
      temperature: 0.3,
      maxTokens: 2048,
    });

    lastResponse = response;

    messages.push({
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      participant: { kind: "AI" },
      role: "assistant",
      content: response.content,
      toolCallId: response.toolCalls?.[0]?.id ?? null,
      toolName: response.toolCalls?.[0]?.function.name ?? null,
      toolArgs: response.toolCalls?.[0] ? JSON.parse(response.toolCalls[0].function.arguments) : null,
      createdAt: Date.now(),
    });

    if (!response.toolCalls || response.toolCalls.length === 0) {
      break;
    }

    for (const tc of response.toolCalls) {
      const toolName = tc.function.name as ToolName;
      const handler = TOOL_HANDLERS[toolName];
      let toolResult: unknown;
      let ok = true;

      try {
        const args = JSON.parse(tc.function.arguments);
        if (handler) {
          toolResult = await handler(
            { actor, conversationId: conversation.id, leadId: input.leadId },
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

      await saveAIAction(
        conversation.id,
        input.leadId ?? null,
        toolName,
        JSON.parse(tc.function.arguments),
        toolResult,
        ok,
        turnCount
      );

      toolResults.push({ tool: toolName, args: JSON.parse(tc.function.arguments), result: toolResult, ok });

      messages.push({
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        participant: { kind: "AI" },
        role: "tool",
        content: JSON.stringify(toolResult),
        toolCallId: tc.id,
        toolName: toolName,
        toolArgs: null,
        createdAt: Date.now(),
      });

      if (!ok) {
        await writeAudit({
          actorUid: "AI",
          event: "AI_TOOL_CALL",
          detail: `tool ${toolName} failed: ${JSON.stringify(toolResult)}`,
          leadId: input.leadId ?? null,
          aiConversationId: conversation.id,
          data: { tool: toolName, error: toolResult },
        });
      }
    }
  }

  const finalMessage = messages.findLast((m) => m.role === "assistant");
  let reply = finalMessage?.content ?? "I've processed your request.";

  reply = stripExactProtectedValues(reply);
  reply = ensureRangeFormat(reply);

  conversation.messages = messages.slice(1);
  conversation.summary = reply.slice(0, 500);
  conversation.promptTokens += lastResponse?.usage?.promptTokens ?? 0;
  conversation.completionTokens += lastResponse?.usage?.completionTokens ?? 0;
  conversation.toolCalls += lastResponse?.toolCalls?.length ?? 0;
  conversation.updatedAt = Date.now();
  conversation.status = "ACTIVE";

  await saveConversation(conversation);

  if (input.leadId) {
    await writeAudit({
      actorUid: "AI",
      event: "AI_TOOL_CALL",
      detail: `agent turn completed for lead ${input.leadId}`,
      leadId: input.leadId,
      aiConversationId: conversation.id,
      data: { toolCalls: toolResults.length, turns: turnCount },
    });
  }

  return { reply, toolCalls: toolResults, conversationId: conversation.id };
}

export async function processPendingAgentTurns(): Promise<number> {
  // This will be called from cron
  return 0;
}