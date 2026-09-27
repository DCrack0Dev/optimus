import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getLead, getTimeline } from "@optimus/lib/domain/leads/service";
import type { LeadId, Uid, UserRole } from "@shared/types";

const Query = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

function actorFromHeaders(req: NextRequest): { uid: Uid; role: UserRole } {
  const uid = (req.headers.get("x-auth-uid") ?? "SYSTEM") as Uid;
  const role = (req.headers.get("x-auth-role") ?? "client") as UserRole;
  return { uid, role };
}

export async function GET(
  req: NextRequest,
  params: { params: { leadId: string } }
) {
  const actor = actorFromHeaders(req);
  const isStaff =
    actor.role === "admin" ||
    actor.role === "staff" ||
    actor.role === "agent" ||
    req.headers.get("x-auth-admin") === "1";
  if (!isStaff) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const id = params.params.leadId as LeadId;
  const existing = await getLead(id);
  if (!existing) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const { searchParams } = new URL(req.url);
  const parsed = Query.safeParse({ limit: searchParams.get("limit") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_query", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const items = await getTimeline(id, { limit: parsed.data.limit ?? 200 });
  return NextResponse.json({ ok: true, leadId: id, items });
}
