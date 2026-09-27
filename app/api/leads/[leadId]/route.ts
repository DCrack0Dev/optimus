import { NextResponse, type NextRequest } from "next/server";
import { LeadPatchSchema } from "@shared/validation/schemas";
import { getLead, updateLead } from "@optimus/lib/domain/leads/service";
import type { LeadId, Uid, UserRole } from "@shared/types";

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
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 }
    );
  }
  const id = params.params.leadId as LeadId;
  const l = await getLead(id);
  if (!l) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, lead: l });
}

export async function PATCH(
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
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 }
    );
  }
  const id = params.params.leadId as LeadId;
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const parsed = LeadPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  // Strip id from patch as it's not allowed in LeadPatch
  const { id: _id, ...patchData } = parsed.data;
  const updated = await updateLead(actor, id, patchData);
  if (!updated) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, lead: updated });
}
