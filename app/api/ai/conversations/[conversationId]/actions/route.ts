import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  getAdminDb,
  isAdminConfigured,
} from "@optimus/lib/firebase/admin";
import type { AIAction, Uid, UserRole } from "@shared/types";

const ParamsSchema = z.object({
  conversationId: z.string().min(1),
});

function actorFromHeaders(req: NextRequest): { uid: Uid; role: UserRole } {
  const uid = (req.headers.get("x-auth-uid") ?? "SYSTEM") as Uid;
  const role = (req.headers.get("x-auth-role") ?? "client") as UserRole;
  return { uid, role };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const { role } = actorFromHeaders(req);
  const isAdmin = role === "admin" || req.headers.get("x-auth-admin") === "1";
  if (!isAdmin && role !== "staff" && role !== "agent") {
    return NextResponse.json(
      { ok: false, error: "forbidden_admin_or_staff" },
      { status: 403 }
    );
  }
  const { conversationId } = await params;
  const parsed = ParamsSchema.safeParse({ conversationId });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_params", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: true, items: [] });
  }
  const db = getAdminDb();
  const snap = await db
    .collection("ai_actions")
    .where("conversationId", "==", conversationId)
    .orderBy("createdAt", "asc")
    .get();

  const items: Array<AIAction & { id: string }> = snap.docs.map((d) => ({ ...(d.data() as AIAction), id: d.id }));
  return NextResponse.json({ ok: true, items });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";