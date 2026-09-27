import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  getAdminDb,
  isAdminConfigured,
} from "@optimus/lib/firebase/admin";
import type { Uid, UserRole } from "@shared/types";
import { writeAudit } from "@optimus/lib/audit/writer";

const ParamsSchema = z.object({
  suppressionId: z.string().min(1),
});

function actorFromHeaders(req: NextRequest): { uid: Uid; role: UserRole; isAdmin: boolean } {
  const uid = (req.headers.get("x-auth-uid") ?? "SYSTEM") as Uid;
  const role = (req.headers.get("x-auth-role") ?? "client") as UserRole;
  const isAdmin = role === "admin" || req.headers.get("x-auth-admin") === "1";
  return { uid, role, isAdmin };
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ suppressionId: string }> }) {
  const { isAdmin } = actorFromHeaders(req);
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: "forbidden_admin_only" }, { status: 403 });
  }

  const { suppressionId } = await params;
  const parsed = ParamsSchema.safeParse({ suppressionId });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_params", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "Firebase Admin not configured" }, { status: 500 });
  }

  const db = getAdminDb();
  const ref = db.collection("suppressions").doc(suppressionId);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const data = snap.data() as any;

  await ref.delete();

  await writeAudit({
    actorUid: "SYSTEM",
    event: "SUPPRESSION_REMOVE",
    detail: `removed suppression ${suppressionId}`,
    data: { suppression: data },
  });

  return NextResponse.json({ ok: true });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";