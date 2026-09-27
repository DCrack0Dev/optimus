import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  getAdminDb,
  isAdminConfigured,
} from "@optimus/lib/firebase/admin";
import type { AIConversation, AIConversationId, Uid, UserRole } from "@shared/types";

const ListQuery = z.object({
  status: z.string().optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().max(500).optional(),
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

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true, items: [], nextCursor: null });
  }
  const db = getAdminDb();
  let query: FirebaseFirestore.Query = db.collection("ai_conversations");
  if (p.status && p.status !== "ALL") {
    query = query.where("status", "==", p.status);
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
        query = query.where("updatedAt", "<", v);
      }
    } catch {
      // ignore bad cursor
    }
  }
  query = query.orderBy("updatedAt", "desc").limit(limit + 1);
  const snap = await query.get();
  const docs = snap.docs.slice();
  let nextCursor: string | null = null;
  const items: Array<AIConversation & { id: AIConversationId }> = [];
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]!;
    if (i >= limit) {
      const data = doc.data() as Partial<AIConversation>;
      const sortValue = data.updatedAt ?? null;
      nextCursor = Buffer.from(JSON.stringify({ v: sortValue })).toString("base64url");
      break;
    }
    items.push({ ...(doc.data() as AIConversation), id: doc.id as AIConversationId });
  }
  return NextResponse.json({ ok: true, items, nextCursor });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";