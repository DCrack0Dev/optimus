import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  getAdminDb,
  isAdminConfigured,
} from "@optimus/lib/firebase/admin";
import type { Uid, UserRole } from "@shared/types";
import { writeAudit } from "@optimus/lib/audit/writer";

const ParamsSchema = z.object({
  ruleId: z.string().min(1),
});

const PatchBody = z.object({
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startUtcMin: z.number().int().min(0).max(1439).optional(),
  endUtcMin: z.number().int().min(0).max(1439).optional(),
  enabled: z.boolean().optional(),
  note: z.string().max(500).nullable().optional(),
}).refine((d) => !(d.startUtcMin !== undefined && d.endUtcMin !== undefined && d.endUtcMin <= d.startUtcMin), {
  message: "End must be after start",
});

function actorFromHeaders(req: NextRequest): { uid: Uid; role: UserRole; isAdmin: boolean } {
  const uid = (req.headers.get("x-auth-uid") ?? "SYSTEM") as Uid;
  const role = (req.headers.get("x-auth-role") ?? "client") as UserRole;
  const isAdmin = role === "admin" || req.headers.get("x-auth-admin") === "1";
  return { uid, role, isAdmin };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ ruleId: string }> }) {
  const { isAdmin } = actorFromHeaders(req);
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: "forbidden_admin_only" }, { status: 403 });
  }

  const { ruleId } = await params;
  const parsedParams = ParamsSchema.safeParse({ ruleId });
  if (!parsedParams.success) {
    return NextResponse.json({ ok: false, error: "invalid_params", issues: parsedParams.error.flatten() }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "Firebase Admin not configured" }, { status: 500 });
  }

  const db = getAdminDb();
  const ref = db.collection("tebogo_availability").doc(ruleId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const patch = { ...parsed.data, updatedAt: Date.now() };
  await ref.set(patch, { merge: true });

  await writeAudit({
    actorUid: "SYSTEM",
    event: "SETTINGS_UPDATE",
    detail: `updated availability rule ${ruleId}`,
    data: { patch },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ ruleId: string }> }) {
  const { isAdmin } = actorFromHeaders(req);
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: "forbidden_admin_only" }, { status: 403 });
  }

  const { ruleId } = await params;
  const parsedParams = ParamsSchema.safeParse({ ruleId });
  if (!parsedParams.success) {
    return NextResponse.json({ ok: false, error: "invalid_params", issues: parsedParams.error.flatten() }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "Firebase Admin not configured" }, { status: 500 });
  }

  const db = getAdminDb();
  const ref = db.collection("tebogo_availability").doc(ruleId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const data = snap.data();

  await ref.delete();

  await writeAudit({
    actorUid: "SYSTEM",
    event: "SETTINGS_UPDATE",
    detail: `deleted availability rule ${ruleId}`,
    data: { rule: data },
  });

  return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";