import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { getAdminDb, isAdminConfigured } from "@optimus/lib/firebase/admin";
import type { LeadId } from "@shared/types";
import { writeAudit } from "@optimus/lib/audit/writer";

const HMAC_SECRET = process.env.WEBHOOK_HMAC_SECRET ?? "";

function verifyUnsubscribeToken(token: string, leadId: string): boolean {
  if (!HMAC_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(leadId)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const leadIdParam = searchParams.get("leadId");
    const email = searchParams.get("email");

    if (!token || !leadIdParam) {
      return NextResponse.redirect(new URL("/unsubscribed?error=invalid_token", req.url));
    }

    if (!isAdminConfigured()) {
      return NextResponse.redirect(new URL("/unsubscribed?error=not_configured", req.url));
    }

    if (!verifyUnsubscribeToken(token, leadIdParam)) {
      await writeAudit({
        actorUid: "CUSTOMER",
        event: "SUPPRESSION_ADD",
        detail: `Invalid unsubscribe token for lead ${leadIdParam}`,
        req,
        leadId: leadIdParam as LeadId,
        data: { token: token.slice(0, 10) + "..." },
      });
      return NextResponse.redirect(new URL("/unsubscribed?error=invalid_token", req.url));
    }

    const db = getAdminDb();

    // Add suppression
    const suppressionId = (
      Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
    ) as import("@shared/types").SuppressionId;

    await db.collection("suppressions").doc(suppressionId).create({
      id: suppressionId,
      email: email?.toLowerCase() ?? null,
      phoneE164: null,
      channel: "EMAIL",
      reason: "UNSUBSCRIBE",
      leadId: leadIdParam as LeadId,
      sourceEventId: null,
      note: "Unsubscribed via email link",
      suppressedAt: Date.now(),
      createdAt: Date.now(),
    });

    // Update lead
    await db.collection("leads").doc(leadIdParam).set(
      {
        marketingUnsubscribed: true,
        marketingUnsubscribedAt: Date.now(),
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    await writeAudit({
      actorUid: "CUSTOMER",
      event: "SUPPRESSION_ADD",
      detail: `Lead ${leadIdParam} unsubscribed via email`,
      leadId: leadIdParam as LeadId,
      data: { suppressionId, channel: "EMAIL", reason: "UNSUBSCRIBE" },
    });

    return NextResponse.redirect(new URL("/unsubscribed?success=true", req.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Unsubscribe error:", err);
    return NextResponse.redirect(new URL(`/unsubscribed?error=${encodeURIComponent(message)}`, req.url));
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";