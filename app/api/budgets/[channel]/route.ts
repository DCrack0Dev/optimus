import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getBudget, incrementAndCheck, setBudgetLimit } from "@optimus/lib/budgets/engine";
import { BudgetChannelSchema } from "@shared/validation/schemas";
import type { Uid, UserRole } from "@shared/types";

const PatchBody = z.object({
  limitDollars: z.number().min(0).max(1_000_000).optional(),
  stopAtBudget: z.boolean().optional(),
  addDollarsUsed: z.number().min(0).max(10_000).optional(),
  context: z.string().max(240).optional()
});

function actorFromHeaders(req: NextRequest): { uid: Uid; role: UserRole | null; isAdmin: boolean } {
  const role = (req.headers.get("x-auth-role") ?? "client") as UserRole;
  const isAdmin = req.headers.get("x-auth-admin") === "1" || role === "admin";
  const uid = (req.headers.get("x-auth-uid") ?? "") as Uid;
  return { uid, role, isAdmin };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { channel: string } }
) {
  const parse = BudgetChannelSchema.safeParse(params.channel);
  if (!parse.success) {
    return NextResponse.json({ ok: false, error: "invalid_channel", issues: parse.error.issues }, { status: 400 });
  }
  const budget = await getBudget(parse.data);
  return NextResponse.json({ ok: true, budget }, { status: 200 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { channel: string } }
) {
  try {
    const actor = actorFromHeaders(req);
    if (!actor.isAdmin || actor.role !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden_admin" }, { status: 403 });
    }
    const chanParse = BudgetChannelSchema.safeParse(params.channel);
    if (!chanParse.success) {
      return NextResponse.json({ ok: false, error: "invalid_channel", issues: chanParse.error.issues }, { status: 400 });
    }
    const raw = await req.json();
    const parse = PatchBody.safeParse(raw);
    if (!parse.success) {
      return NextResponse.json({ ok: false, error: "invalid_body", issues: parse.error.issues }, { status: 400 });
    }
    if (typeof parse.data.limitDollars !== "undefined" || typeof parse.data.stopAtBudget !== "undefined") {
      const r = await setBudgetLimit(
        { uid: actor.uid, role: actor.role ?? "client" },
        chanParse.data,
        {
          limitDollars: parse.data.limitDollars,
          stopAtBudget: parse.data.stopAtBudget
        }
      );
      if (!r.ok) {
        return NextResponse.json({ ok: false, error: r.reason ?? "update_failed" }, { status: 400 });
      }
    }
    if (typeof parse.data.addDollarsUsed === "number") {
      await incrementAndCheck(
        { uid: actor.uid, role: actor.role },
        chanParse.data,
        parse.data.addDollarsUsed,
        { context: parse.data.context }
      );
    }
    const budget = await getBudget(chanParse.data);
    return NextResponse.json({ ok: true, budget }, { status: 200 });
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
