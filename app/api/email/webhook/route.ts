import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { handleEmailWebhook } from "@optimus/lib/domain/email/service";
import { writeAudit } from "@optimus/lib/audit/writer";

const WEBHOOK_SECRET = process.env.BREVO_WEBHOOK_SECRET ?? "";

function verifyBrevoSignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return true; // Allow in dev if not set
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function mapBrevoEvent(type: string): string {
  switch (type) {
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "opened":
      return "opened";
    case "clicked":
      return "clicked";
    case "reply":
      return "replied";
    case "hardBounce":
      return "bounce";
    case "softBounce":
      return "bounce";
    case "complaint":
      return "complaint";
    case "unsubscribed":
      return "unsubscribed";
    case "error":
      return "error";
    case "invalid":
      return "invalid";
    default:
      return "error";
  }
}

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-brevo-signature") ?? "";
    const rawBody = await req.text();

    if (WEBHOOK_SECRET && !verifyBrevoSignature(rawBody, signature)) {
      await writeAudit({
        actorUid: "SYSTEM",
        event: "EMAIL_SEND",
        detail: "Brevo webhook signature verification failed",
        req,
        data: { signature: signature.slice(0, 10) + "..." },
      });
      return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
    }

    let events: any[];
    try {
      events = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    if (!Array.isArray(events)) {
      events = [events];
    }

    for (const evt of events) {
      const eventType = mapBrevoEvent(evt.event ?? evt.type ?? "");
      const emailId = evt.messageId ?? evt.emailId ?? evt["message-id"];
      const timestamp = evt.ts ? Number(evt.ts) * 1000 : Date.now();

      if (!emailId) continue;

      await handleEmailWebhook({
        type: eventType,
        emailId,
        timestamp,
        data: evt,
      });
    }

    return NextResponse.json({ ok: true, processed: events.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Brevo webhook error:", err);
    return NextResponse.json({ ok: false, error: "internal", detail: message }, { status: 500 });
  }
}

export const runtime = "nodejs";