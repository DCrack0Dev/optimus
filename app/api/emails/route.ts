import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  getAdminDb,
  isAdminConfigured,
} from "@optimus/lib/firebase/admin";
import type { EmailDoc, EmailId, EmailStatus, Uid, UserRole } from "@shared/types";

const ListQuery = z.object({
  status: z.string().optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().max(500).optional(),
  sort: z.enum(["createdAt", "sentAt", "replyAt"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

function actorFromHeaders(req: NextRequest): { uid: Uid; role: UserRole } {
  const uid = (req.headers.get("x-auth-uid") ?? "SYSTEM") as Uid;
  const role = (req.headers.get("x-auth-role") ?? "client") as UserRole;
  return { uid, role };
}

export async function GET(req: NextRequest) {
  const { role } = actorFromHeaders(req);
  const isAdmin = role === "admin" || req.headers.get("x-auth-admin") === "1";
  if (!isAdmin && role !== "staff" && role !== "agent") {
    return NextResponse.json(
      { ok: false, error: "forbidden_admin_or_staff" },
      { status: 403 }
    );
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
  const sortField: "createdAt" | "sentAt" | "replyAt" = p.sort ?? "createdAt";
  const sortDir: "asc" | "desc" = p.sortDir ?? "desc";

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true, items: [], nextCursor: null });
  }
  const db = getAdminDb();
  let query: FirebaseFirestore.Query = db.collection("emails");
  if (p.status && p.status !== "ALL") {
    query = query.where("status", "==", p.status as EmailStatus);
  }
  if (p.q?.trim()) {
    const qnorm = p.q.trim().toLowerCase();
    query = query.where("_searchTerms", "array-contains", qnorm);
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
  const items: Array<EmailDoc & { id: EmailId }> = [];
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]!;
    if (i >= limit) {
      const data = doc.data() as Partial<EmailDoc>;
      const sortValue = data[sortField] ?? null;
      nextCursor = Buffer.from(JSON.stringify({ v: sortValue })).toString("base64url");
      break;
    }
    items.push({ ...(doc.data() as EmailDoc), id: doc.id as EmailId });
  }
  return NextResponse.json({ ok: true, items, nextCursor });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";