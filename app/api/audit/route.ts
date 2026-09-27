import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAdminDb, isAdminConfigured } from "@optimus/lib/firebase/admin";
import type { AuditEvent, UserRole } from "@shared/types";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().max(128).optional(),
  event: z.string().max(64).optional(),
  actorUid: z.string().max(128).optional(),
  leadId: z.string().max(128).optional()
});

function isAdmin(req: NextRequest): boolean {
  const role = req.headers.get("x-auth-role");
  const adminHeader = req.headers.get("x-auth-admin");
  return adminHeader === "1" || role === "admin";
}

export async function GET(req: NextRequest) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ ok: false, error: "forbidden_admin" }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const parse = QuerySchema.safeParse({
      limit: searchParams.get("limit") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      event: searchParams.get("event") ?? undefined,
      actorUid: searchParams.get("actorUid") ?? undefined,
      leadId: searchParams.get("leadId") ?? undefined
    });
    if (!parse.success) {
      return NextResponse.json({ ok: false, error: "invalid_query", issues: parse.error.issues }, { status: 400 });
    }
    const q = parse.data;
    if (!isAdminConfigured()) {
      return NextResponse.json({ ok: true, rows: [], nextCursor: null, count: 0 });
    }
    const db = getAdminDb();
    let col = db
      .collection("audit_logs")
      .orderBy("createdAt", "desc") as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;
    if (q.event) col = col.where("event", "==", q.event as AuditEvent);
    if (q.actorUid) col = col.where("actorUid", "==", q.actorUid as UserRole);
    if (q.leadId) col = col.where("leadId", "==", q.leadId);
    col = col.limit(q.limit);
    if (q.cursor) {
      try {
        const snap = await db.collection("audit_logs").doc(q.cursor).get();
        if (snap.exists) col = col.startAfter(snap);
      } catch {
        // ignore bad cursor
      }
    }
    const snap = await col.get();
    const rows = snap.docs.map((d) => d.data());
    const last = snap.docs[snap.docs.length - 1]?.id ?? null;
    return NextResponse.json(
      { ok: true, rows, nextCursor: last, count: rows.length },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: "internal", detail: process.env.NODE_ENV === "production" ? undefined : message },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
