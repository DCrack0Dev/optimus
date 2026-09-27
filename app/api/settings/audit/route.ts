import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  getAdminDb,
  isAdminConfigured,
} from "@optimus/lib/firebase/admin";
import type { AuditLog, AuditLogId, Uid, UserRole } from "@shared/types";

const ListQuery = z.object({
  event: z.string().optional(),
  actor: z.string().optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().max(500).optional(),
  sort: z.enum(["createdAt"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

function actorFromHeaders(req: NextRequest): { uid: Uid; role: UserRole; isAdmin: boolean } {
  const uid = (req.headers.get("x-auth-uid") ?? "SYSTEM") as Uid;
  const role = (req.headers.get("x-auth-role") ?? "client") as UserRole;
  const isAdmin = role === "admin" || req.headers.get("x-auth-admin") === "1";
  return { uid, role, isAdmin };
}

export async function GET(req: NextRequest) {
  const { isAdmin } = actorFromHeaders(req);
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: "forbidden_admin_only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const raw: Record<string, unknown> = {};
  for (const [k, v] of searchParams.entries()) {
    raw[k] = v;
  }
  const parsed = ListQuery.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_query", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const p = parsed.data;
  const limit = Math.max(1, Math.min(200, p.limit ?? 50));
  const sortField: "createdAt" = p.sort ?? "createdAt";
  const sortDir: "asc" | "desc" = p.sortDir ?? "desc";

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true, items: [], nextCursor: null });
  }
  const db = getAdminDb();
  let query: FirebaseFirestore.Query = db.collection("audit_logs");
  if (p.event && p.event !== "ALL") {
    query = query.where("event", "==", p.event);
  }
  if (p.actor && p.actor !== "ALL") {
    query = query.where("actorUid", "==", p.actor);
  }
  if (p.q?.trim()) {
    // Search in detail field - Firestore doesn't support text search natively
    // We'll filter in memory for small datasets, or use a search field in production
  }
  if (p.cursor) {
    try {
      const raw = Buffer.from(p.cursor, "base64url").toString("utf8");
      const parsed = JSON.parse(raw) as { v: number | null };
      const v = parsed.v;
      if (v !== null && typeof v === "number") {
        query = sortDir === "desc" ? query.where(sortField, "<", v) : query.where(sortField, ">", v);
      }
    } catch {
      // ignore bad cursor
    }
  }
  query = query.orderBy(sortField, sortDir).limit(limit + 1);
  const snap = await query.get();
  const docs = snap.docs.slice();
  let nextCursor: string | null = null;
  const items: Array<AuditLog & { id: AuditLogId }> = [];
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]!;
    if (i >= limit) {
      const data = doc.data() as Partial<AuditLog>;
      const sortValue = data[sortField] ?? null;
      nextCursor = Buffer.from(JSON.stringify({ v: sortValue })).toString("base64url");
      break;
    }
    items.push({ ...(doc.data() as AuditLog), id: doc.id as AuditLogId });
  }

  // Client-side filtering for search query
  let filtered = items;
  if (p.q?.trim()) {
    const qnorm = p.q.trim().toLowerCase();
    filtered = items.filter(
      (it) =>
        it.detail?.toLowerCase().includes(qnorm) ||
        JSON.stringify(it.data).toLowerCase().includes(qnorm) ||
        it.event.toLowerCase().includes(qnorm)
    );
  }

  return NextResponse.json({ ok: true, items: filtered, nextCursor });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";