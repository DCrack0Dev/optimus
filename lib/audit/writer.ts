import type { NextRequest } from "next/server";
import { getAdminDb, isAdminConfigured } from "@optimus/lib/firebase/admin";
import type { AuditEvent, AuditLog, Uid } from "@shared/types";

type AuditWriteInput = {
  actorUid: Uid | "AI" | "SYSTEM" | "CUSTOMER" | null;
  event: AuditEvent;
  req?: Pick<NextRequest, "headers" | "ip"> | null;
  ip?: string | null;
  userAgent?: string | null;
  detail?: string | null;
  leadId?: string | null;
  emailId?: string | null;
  callId?: string | null;
  quoteId?: string | null;
  bookingId?: string | null;
  aiConversationId?: string | null;
  aiActionId?: string | null;
  aiQueueId?: string | null;
  data?: Record<string, unknown>;
};

function fromHeaders(req: AuditWriteInput["req"]): { ip: string | null; ua: string | null } {
  if (!req) return { ip: null, ua: null };
  let ip: string | null = req.ip ?? null;
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (!ip && forwardedFor) {
    ip = forwardedFor.split(",")[0]?.trim() ?? null;
  }
  const realIp = req.headers.get("x-real-ip");
  if (!ip && realIp) ip = realIp;
  const ua = req.headers.get("user-agent");
  return { ip, ua };
}

export async function writeAudit(input: AuditWriteInput): Promise<{ ok: boolean; refId: string | null }> {
  try {
    if (!isAdminConfigured()) {
      return { ok: true, refId: null };
    }
    const headers = fromHeaders(input.req ?? null);
    const db = getAdminDb();
    const ts = Date.now();
    const payload: Omit<AuditLog, "id"> = {
      actorUid: input.actorUid ?? null,
      ip: input.ip ?? headers.ip ?? null,
      userAgent: input.userAgent ?? headers.ua ?? null,
      event: input.event,
      detail: input.detail ?? null,
      leadId: input.leadId ?? null,
      emailId: input.emailId ?? null,
      callId: input.callId ?? null,
      quoteId: input.quoteId ?? null,
      bookingId: input.bookingId ?? null,
      aiConversationId: input.aiConversationId ?? null,
      aiActionId: input.aiActionId ?? null,
      aiQueueId: input.aiQueueId ?? null,
      data: input.data ?? {},
      createdAt: ts
    };
    const ref = db.collection("audit_logs").doc();
    await ref.set({ id: ref.id, ...payload });
    return { ok: true, refId: ref.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("writeAudit failed:", message);
    return { ok: false, refId: null };
  }
}
