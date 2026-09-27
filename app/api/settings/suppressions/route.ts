import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  getAdminDb,
  isAdminConfigured,
} from "@optimus/lib/firebase/admin";
import type { Suppression, SuppressionId, Uid, UserRole } from "@shared/types";
import { writeAudit } from "@optimus/lib/audit/writer";

const SuppressionReasonSchema = z.enum([
  "UNSUBSCRIBE",
  "BOUNCE_HARD",
  "COMPLAINT",
  "OPT_OUT_MANUAL",
  "LEAD_REQUESTED",
  "GLOBAL_BLACKLIST",
]);

const ChannelSchema = z.enum(["EMAIL", "WHATSAPP", "CALL", "ALL"]);

const CreateBody = z.object({
  email: z.string().email().nullable().optional(),
  phoneE164: z.string().regex(/^\+[1-9]\d{4,14}$/).nullable().optional(),
  channel: ChannelSchema.default("ALL"),
  reason: SuppressionReasonSchema.default("OPT_OUT_MANUAL"),
  note: z.string().max(2000).nullable().optional(),
}).refine((d) => d.email || d.phoneE164, { message: "Email or phone required" });

function actorFromHeaders(req: NextRequest): { uid: Uid; role: UserRole; isAdmin: boolean } {
  const uid = (req.headers.get("x-auth-uid") ?? "SYSTEM") as Uid;
  const role = (req.headers.get("x-auth-role") ?? "client") as UserRole;
  const isAdmin = role === "admin" || req.headers.get("x-auth-admin") === "1";
  return { uid, role, isAdmin };
}

function suppressionId(): SuppressionId {
  return `sup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` as SuppressionId;
}

export async function GET(req: NextRequest) {
  const { isAdmin } = actorFromHeaders(req);
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: "forbidden_admin_only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(200, Number(searchParams.get("limit") ?? 50)));
  const cursor = searchParams.get("cursor");

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true, items: [], nextCursor: null });
  }

  const db = getAdminDb();
  let query: FirebaseFirestore.Query = db.collection("suppressions").orderBy("createdAt", "desc");
  if (cursor) {
    try {
      const raw = Buffer.from(cursor, "base64url").toString("utf8");
      const parsed = JSON.parse(raw) as { v: number | null };
      const v = parsed.v;
      if (v !== null && typeof v === "number") {
        query = query.where("createdAt", "<", v);
      }
    } catch {
      // ignore bad cursor
    }
  }
  query = query.limit(limit + 1);
  const snap = await query.get();
  const docs = snap.docs.slice();
  let nextCursor: string | null = null;
  const items: Array<Suppression & { id: SuppressionId }> = [];
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]!;
    if (i >= limit) {
      const data = doc.data() as Partial<Suppression>;
      const sortValue = data.createdAt ?? null;
      nextCursor = Buffer.from(JSON.stringify({ v: sortValue })).toString("base64url");
      break;
    }
    items.push({ ...(doc.data() as Suppression), id: doc.id as SuppressionId });
  }
  return NextResponse.json({ ok: true, items, nextCursor });
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
  const id = suppressionId();
  const suppression: Suppression = {
    id,
    email: parsed.data.email?.toLowerCase() ?? null,
    phoneE164: parsed.data.phoneE164 ?? null,
    channel: parsed.data.channel,
    reason: parsed.data.reason,
    leadId: null,
    sourceEventId: null,
    note: parsed.data.note ?? null,
    suppressedAt: now,
    createdAt: now,
  };

  await db.collection("suppressions").doc(id).create(suppression);

  await writeAudit({
    actorUid: uid,
    event: "SUPPRESSION_ADD",
    detail: `suppression ${id} ${suppression.email ?? suppression.phoneE164 ?? ""}`,
    data: { suppression },
  });

  return NextResponse.json({ ok: true, suppression }, { status: 201 });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";