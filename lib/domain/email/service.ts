import { getAdminDb, isAdminConfigured } from "@optimus/lib/firebase/admin";
import type { EmailId, LeadId, Uid, UserRole } from "@shared/types";
import { writeAudit } from "@optimus/lib/audit/writer";
import { toolMiddleware } from "@optimus/lib/tools/middleware";
import type { EmailSendInput, EmailSendResult, EmailProvider } from "@optimus/lib/providers/email/types";
import { createBrevoAdapter } from "@optimus/lib/providers/email/brevo-adapter";

function emailId(): EmailId {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  ) as EmailId;
}

function getEmailProvider(): EmailProvider | null {
  return createBrevoAdapter();
}

export interface SendLeadEmailInput {
  actor: { uid: Uid | "AI" | "SYSTEM"; role?: UserRole | null };
  origin: "DASHBOARD" | "AI" | "CAMPAIGN" | "FOLLOWUP";
  leadId: LeadId | null;
  toEmail: string;
  toName?: string | null;
  subject: string;
  html?: string | null;
  text?: string | null;
  templateId?: string | null;
  templateVariables?: Record<string, unknown>;
  unsubscribeToken?: string | null;
  replyToEmail?: string | null;
}

export async function sendLeadEmail(
  input: SendLeadEmailInput
): Promise<{ ok: true; emailId: EmailId; result: EmailSendResult } | { ok: false; error: string }> {
  const provider = getEmailProvider();
  if (!provider) {
    return { ok: false, error: "Email provider not configured" };
  }

  const middlewareResult = await toolMiddleware({
    actor: { uid: input.actor.uid, role: input.actor.role ?? null },
    origin: input.origin,
    channel: "EMAIL",
    outbound: true,
    estimatedDollars: 0.001,
    leadId: input.leadId,
    tool: "sendEmail",
    recipientEmail: input.toEmail,
    context: `origin=${input.origin}`,
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
  const id = emailId();
  const now = Date.now();

  const fromEmail = process.env.BREVO_SENDER_EMAIL ?? "noreply@demitechwebservices.live";
  const fromName = process.env.BREVO_SENDER_NAME ?? "DemiTech Web Services";

  const sendInput: EmailSendInput = {
    toEmail: input.toEmail,
    toName: input.toName,
    fromEmail,
    fromName,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyToEmail: input.replyToEmail,
    unsubscribeToken: input.unsubscribeToken,
    leadId: input.leadId ?? undefined,
  };

  const result = await provider.send(sendInput);

  const emailDoc = {
    id,
    leadId: input.leadId,
    fromEmail,
    fromName,
    toEmail: input.toEmail,
    toName: input.toName,
    subject: input.subject,
    html: input.html ?? null,
    text: input.text ?? null,
    provider: "brevo",
    providerMessageId: result.providerMessageId ?? null,
    replyToEmail: input.replyToEmail ?? null,
    status: result.success ? "SENT" : "FAILED",
    events: result.success
      ? [{ id: `evt_${Date.now()}`, status: "SENT", at: now, detail: "Sent via Brevo" }]
      : [{ id: `evt_${Date.now()}`, status: "FAILED", at: now, detail: result.error ?? "Failed" }],
    openedAt: null,
    clickedAt: null,
    replyAt: null,
    attachments: [],
    suppressUnsubscribeLink: false,
    unsubscribeToken: input.unsubscribeToken ?? null,
    sentAt: result.success ? now : null,
    createdBy: input.actor.uid,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection("emails").doc(id).create(emailDoc);

  if (input.leadId) {
    await db.collection("leads").doc(input.leadId).set(
      {
        status: "CONTACTED",
        lastContactAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  }

  await writeAudit({
    actorUid: input.actor.uid,
    event: "EMAIL_SEND",
    detail: `email to ${input.toEmail} ${result.success ? "sent" : "failed"}`,
    leadId: input.leadId,
    emailId: id,
    data: { providerMessageId: result.providerMessageId, success: result.success, error: result.error },
  });

  return { ok: true, emailId: id, result };
}

export async function handleEmailWebhook(
  event: {
    type: string;
    emailId: string;
    timestamp: number;
    data?: Record<string, unknown>;
  }
): Promise<{ ok: boolean; error?: string }> {
  if (!isAdminConfigured()) return { ok: false, error: "Firebase Admin not configured" };

  const db = getAdminDb();
  const ref = db.collection("emails").doc(event.emailId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "email_not_found" };

  const emailDoc = snap.data() as any;
  const events = emailDoc.events ?? [];
  const now = event.timestamp;

  let newStatus = emailDoc.status;
  let newOpenedAt = emailDoc.openedAt;
  let newClickedAt = emailDoc.clickedAt;
  let newReplyAt = emailDoc.replyAt;

  switch (event.type) {
    case "delivered":
      newStatus = "DELIVERED";
      break;
    case "opened":
      if (newStatus !== "OPENED" && newStatus !== "CLICKED" && newStatus !== "REPLIED") {
        newStatus = "OPENED";
      }
      if (!newOpenedAt) newOpenedAt = now;
      break;
    case "clicked":
      if (newStatus !== "CLICKED" && newStatus !== "REPLIED") {
        newStatus = "CLICKED";
      }
      if (!newClickedAt) newClickedAt = now;
      break;
    case "replied":
      newStatus = "REPLIED";
      if (!newReplyAt) newReplyAt = now;
      break;
    case "bounce":
      newStatus = "BOUNCE_HARD";
      break;
    case "complaint":
      newStatus = "COMPLAINT";
      break;
    case "unsubscribed":
      newStatus = "UNSUBSCRIBED";
      break;
    case "error":
    case "invalid":
      newStatus = "FAILED";
      break;
  }

  events.push({
    id: `evt_${now}`,
    status: event.type.toUpperCase(),
    at: now,
    detail: event.data ? JSON.stringify(event.data) : null,
  });

  await ref.update({
    status: newStatus,
    events,
    openedAt: newOpenedAt,
    clickedAt: newClickedAt,
    replyAt: newReplyAt,
    updatedAt: Date.now(),
  });

  if (emailDoc.leadId) {
    await db.collection("leads").doc(emailDoc.leadId).set(
      { lastContactAt: now, updatedAt: now },
      { merge: true }
    );
  }

  await writeAudit({
    actorUid: "SYSTEM",
    event: "EMAIL_SEND",
    detail: `webhook ${event.type} for email ${event.emailId}`,
    leadId: emailDoc.leadId ?? null,
    emailId: event.emailId,
    data: { webhookEvent: event.type },
  });

  return { ok: true };
}