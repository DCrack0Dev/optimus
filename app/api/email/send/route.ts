import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sendLeadEmail } from "@optimus/lib/domain/email/service";
import type { LeadId, Uid, UserRole } from "@shared/types";

const SendBodySchema = z.object({
  leadId: z.string().min(1).max(128).nullable().optional(),
  toEmail: z.string().email(),
  toName: z.string().max(200).nullable().optional(),
  subject: z.string().min(1).max(300),
  html: z.string().max(500_000).nullable().optional(),
  text: z.string().max(500_000).nullable().optional(),
  templateId: z.string().max(120).nullable().optional(),
  templateVariables: z.record(z.unknown()).default({}),
  unsubscribeToken: z.string().max(512).nullable().optional(),
  replyToEmail: z.string().email().nullable().optional(),
});

function actorFromHeaders(req: NextRequest): { uid: Uid; role: UserRole; isAdmin: boolean } {
  const role = (req.headers.get("x-auth-role") ?? "client") as UserRole;
  const isAdmin = req.headers.get("x-auth-admin") === "1" || role === "admin";
  const uid = (req.headers.get("x-auth-uid") ?? "SYSTEM") as Uid;
  return { uid, role, isAdmin };
}

export async function POST(req: NextRequest) {
  try {
    const actor = actorFromHeaders(req);
    if (!actor.isAdmin) {
      return NextResponse.json({ ok: false, error: "forbidden_admin" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = SendBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "invalid_payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await sendLeadEmail({
      actor: { uid: actor.uid, role: actor.role },
      origin: "DASHBOARD",
      leadId: parsed.data.leadId as LeadId | null,
      toEmail: parsed.data.toEmail,
      toName: parsed.data.toName,
      subject: parsed.data.subject,
      html: parsed.data.html,
      text: parsed.data.text,
      templateId: parsed.data.templateId,
      templateVariables: parsed.data.templateVariables,
      unsubscribeToken: parsed.data.unsubscribeToken,
      replyToEmail: parsed.data.replyToEmail,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, emailId: result.emailId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: "internal", detail: message }, { status: 500 });
  }
}

export const runtime = "nodejs";