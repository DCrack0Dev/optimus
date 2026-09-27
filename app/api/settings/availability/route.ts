import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  getAdminDb,
  isAdminConfigured,
} from "@optimus/lib/firebase/admin";
import type { TebogoAvailabilityRule, TebogoAvailabilityRuleId, Uid, UserRole } from "@shared/types";
import { writeAudit } from "@optimus/lib/audit/writer";

const CreateBody = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startUtcMin: z.number().int().min(0).max(1439),
  endUtcMin: z.number().int().min(0).max(1439),
  enabled: z.boolean().default(true),
  note: z.string().max(500).nullable().optional(),
}).refine((d) => d.endUtcMin > d.startUtcMin, { message: "End must be after start" });

function actorFromHeaders(req: NextRequest): { uid: Uid; role: UserRole; isAdmin: boolean } {
  const uid = (req.headers.get("x-auth-uid") ?? "SYSTEM") as Uid;
  const role = (req.headers.get("x-auth-role") ?? "client") as UserRole;
  const isAdmin = role === "admin" || req.headers.get("x-auth-admin") === "1";
  return { uid, role, isAdmin };
}

function ruleId(): TebogoAvailabilityRuleId {
  return `avail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` as TebogoAvailabilityRuleId;
}

export async function GET(req: NextRequest) {
  const { isAdmin } = actorFromHeaders(req);
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: "forbidden_admin_only" }, { status: 403 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true, items: [] });
  }

  const db = getAdminDb();
  const snap = await db.collection("tebogo_availability").orderBy("dayOfWeek").orderBy("startUtcMin").get();
  const items: Array<TebogoAvailabilityRule & { id: TebogoAvailabilityRuleId }> = snap.docs.map((d) => ({
    ...(d.data() as TebogoAvailabilityRule),
    id: d.id as TebogoAvailabilityRuleId,
  }));
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest) {
  const { uid, isAdmin } = actorFromHeaders(req);
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: "forbidden_admin_only" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "Firebase Admin not configured" }, { status: 500 });
  }

  const db = getAdminDb();
  const now = Date.now();
  const id = ruleId();
  const rule: TebogoAvailabilityRule = {
    id,
    dayOfWeek: parsed.data.dayOfWeek,
    startUtcMin: parsed.data.startUtcMin,
    endUtcMin: parsed.data.endUtcMin,
    timezoneIana: "Africa/Johannesburg",
    enabled: parsed.data.enabled,
    note: parsed.data.note ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection("tebogo_availability").doc(id).create(rule);

  await writeAudit({
    actorUid: uid,
    event: "SETTINGS_UPDATE",
    detail: `created availability rule ${id}`,
    data: { rule },
  });

  return NextResponse.json({ ok: true, rule }, { status: 201 });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";