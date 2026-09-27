import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  LeadSchema,
  LeadStatusSchema,
  LeadSourceSchema,
  ServiceInterestSchema,
  SortDirectionSchema,
} from "@shared/validation/schemas";
import {
  createLead,
  enforcePermissionAndBudgetForCreate,
  listLeads,
} from "@optimus/lib/domain/leads/service";
import type { LeadStatus, LeadSource, ServiceInterest, Uid, UserRole } from "@shared/types";

const ListQuery = z.object({
  status: LeadStatusSchema.optional(),
  statuses: z.array(LeadStatusSchema).max(10).optional(),
  source: LeadSourceSchema.optional(),
  service: ServiceInterestSchema.optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().max(500).optional(),
  sort: z.enum(["updatedAt", "createdAt", "lastContactAt"]).optional(),
  sortDir: SortDirectionSchema.optional(),
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
    if (k === "statuses") {
      const arr = raw.statuses as string[] | undefined;
      raw.statuses = arr ? [...arr, v] : [v];
    } else if (k === "status") {
      raw.status = v;
    } else {
      raw[k] = v;
    }
  }
  const parsed = ListQuery.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_query", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const p = parsed.data;
  const statusOrStatuses: LeadStatus | LeadStatus[] | undefined = p.statuses
    ? p.statuses
    : p.status;
  const result = await listLeads({
    status: statusOrStatuses as (LeadStatus | LeadStatus[]) | undefined,
    source: p.source as LeadSource | undefined,
    service: p.service as ServiceInterest | undefined,
    q: p.q,
    limit: p.limit,
    cursor: p.cursor,
    sort: p.sort,
    sortDir: p.sortDir as "asc" | "desc" | undefined,
  });
  return NextResponse.json({
    ok: true,
    items: result.items,
    nextCursor: result.nextCursor,
  });
}

export async function POST(req: NextRequest) {
  const actor = actorFromHeaders(req);
  const isAdmin = actor.role === "admin" || req.headers.get("x-auth-admin") === "1";
  if (!isAdmin && actor.role !== "staff" && actor.role !== "agent" && actor.uid !== "SYSTEM" && actor.uid !== "AI" as unknown as Uid) {
    return NextResponse.json(
      { ok: false, error: "forbidden_create_lead" },
      { status: 403 }
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 }
    );
  }
  const parsed = LeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const g = await enforcePermissionAndBudgetForCreate(actor, { headers: req.headers as any });
  if (!g.ok) {
    return NextResponse.json(
      { ok: false, error: g.error },
      { status: g.status }
    );
  }
  const created = await createLead(actor, parsed.data);
  if (!created) {
    return NextResponse.json(
      { ok: false, error: "lead_create_failed" },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, lead: created }, { status: 201 });
}
