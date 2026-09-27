import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getAdminDb,
  isAdminConfigured,
} from "@optimus/lib/firebase/admin";
import { WebsiteEventSchema, WebsiteEventTypeSchema } from "@shared/validation/schemas";
import { findOrCreateLead, appendInteraction } from "@optimus/lib/domain/leads/service";
import type { LeadSource, WebsiteEventId, Uid } from "@shared/types";
import { writeAudit } from "@optimus/lib/audit/writer";
import { enqueueAgentTurn } from "@optimus/lib/ai/queue";

function mapEventTypeToSource(type: string): LeadSource {
  switch (type) {
    case "QUOTE_REQUEST":
      return "WEBSITE_QUOTE";
    case "REGISTRATION":
      return "WEBSITE_REGISTRATION";
    case "APP_REQUEST":
      return "WEBSITE_APP_REQUEST";
    case "CONTACT_REQUEST":
      return "WEBSITE_CONTACT";
    case "BOOKING_REQUEST":
      return "WEBSITE_BOOKING";
    default:
      return "OTHER";
  }
}

function mapEventTypeToService(_type: string, payload: Record<string, unknown>): import("@shared/types").ServiceInterest | null {
  const service = payload?.service as string | undefined;
  if (!service) return null;
  const normalized = service.toUpperCase().replace(/\s+/g, "_").replace(/-/g, "_");
  const validServices = [
    "WEBSITE", "WEB_APP", "MOBILE_APP", "SEO", 
    "BOOKING_SYSTEM", "CRM_DASHBOARD", "ECOMMERCE", "CUSTOM"
  ];
  return validServices.includes(normalized) ? normalized as any : "CUSTOM";
}

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const parsed = WebsiteEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "invalid_payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { type, payload, idempotencyKey, sessionId, visitorId, userId, url, referrer, userAgent } = parsed.data;

    if (!isAdminConfigured()) {
      return NextResponse.json({ ok: true, received: type, dev: true });
    }

    const db = getAdminDb();

    // Check idempotency key
    if (idempotencyKey) {
      const existing = await db
        .collection("website_events")
        .where("idempotencyKey", "==", idempotencyKey)
        .where("createdAt", ">=", Date.now() - 24 * 60 * 60 * 1000)
        .limit(1)
        .get();
      if (!existing.empty) {
        return NextResponse.json({ ok: true, received: type, duplicate: true });
      }
    }

    const now = Date.now();
    const leadSources: LeadSource[] = [
      "WEBSITE_QUOTE",
      "WEBSITE_REGISTRATION",
      "WEBSITE_APP_REQUEST",
      "WEBSITE_CONTACT",
      "WEBSITE_BOOKING",
    ];
    const shouldCreateLead = leadSources.includes(mapEventTypeToSource(type));

    let leadId: string | null = null;
    let leadCreated = false;

    if (shouldCreateLead && payload && typeof payload === "object") {
      const p = payload as Record<string, unknown>;
      const email = (p.email as string | undefined)?.trim() || undefined;
      const phoneE164 = (p.phone as string | undefined)?.trim() || (p.whatsapp as string | undefined)?.trim() || undefined;
      const firstName = (p.name as string | undefined)?.split(" ")[0] || (p.firstName as string | undefined);
      const lastName = (p.name as string | undefined)?.split(" ").slice(1).join(" ") || (p.lastName as string | undefined);
      const company = (p.company as string | undefined)?.trim() || undefined;

      if (email || phoneE164) {
        const source = mapEventTypeToSource(type);
        const service = mapEventTypeToService(type, p);
        const result = await findOrCreateLead(
          { uid: "SYSTEM" as Uid, role: null },
          {
            firstName: firstName ?? undefined,
            lastName: lastName ?? undefined,
            company,
            email,
            phoneE164,
            source,
            servicesInterested: service ? [service] : [],
          }
        );
        if (result) {
          leadId = result.id;
          leadCreated = result.created ?? false;
        }
      }
    }

    // Create website_event document
    const websiteEventId = (
      Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
    ) as WebsiteEventId;

    const websiteEventDoc = {
      id: websiteEventId,
      type: type as z.infer<typeof WebsiteEventTypeSchema>,
      sessionId: sessionId ?? null,
      visitorId: visitorId ?? null,
      userId: userId ? (userId as Uid) : null,
      leadId: leadId as import("@shared/types").LeadId | null,
      idempotencyKey: idempotencyKey ?? null,
      url: url ?? null,
      referrer: referrer ?? null,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? 
          req.headers.get("x-real-ip") ?? 
          null,
      userAgent: userAgent ?? req.headers.get("user-agent") ?? null,
      payload: payload as Record<string, unknown> ?? {},
      createdAt: now,
    };

    await db.collection("website_events").doc(websiteEventId).create(websiteEventDoc);

    // Append to lead timeline if lead exists
    if (leadId) {
      await appendInteraction(
        { uid: "SYSTEM" as Uid, role: null },
        leadId as import("@shared/types").LeadId,
        {
          type: "website_event",
          websiteEventId,
          eventType: type,
          summary: `Website event: ${type}${url ? ` · ${url}` : ""}`,
          at: now,
          data: { eventType: type, url: url ?? null },
        },
        { updateLastContactAt: true }
      );

      // Enqueue AI turn for lead-generating events
      if (leadCreated && shouldCreateLead) {
        await enqueueAgentTurn({
          leadId: leadId as import("@shared/types").LeadId,
          trigger: `website_event:${type}`,
          idempotencyKey: `ai-${websiteEventId}`,
          payload: { websiteEventId, type, leadId, leadCreated },
        });
      }
    }

    await writeAudit({
      actorUid: "SYSTEM",
      event: "LEAD_CREATE",
      detail: `website_event ${type}${leadId ? ` -> lead ${leadId}` : ""}`,
      leadId: leadId ?? null,
      req,
      data: { websiteEventId, type, leadCreated },
    });

    return NextResponse.json({ ok: true, received: type, leadId, leadCreated }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("api/website-events err", err);
    return NextResponse.json({ ok: false, error: "server_error", detail: message }, { status: 500 });
  }
}