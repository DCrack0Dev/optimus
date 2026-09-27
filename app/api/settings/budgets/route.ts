import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  getAdminDb,
  isAdminConfigured,
} from "@optimus/lib/firebase/admin";

// Ensure TypeScript recognizes these imports as used
void getAdminDb;
void isAdminConfigured;
import { getBudget, setBudgetLimit } from "@optimus/lib/budgets/engine";
import type { Budget, BudgetChannel, Uid, UserRole } from "@shared/types";

const BudgetChannelSchema = z.enum(["AI", "EMAIL", "VOICE", "WHATSAPP", "TOTAL_OUTREACH"]);

const SetBudgetBody = z.object({
  channel: BudgetChannelSchema,
  limitDollars: z.number().min(0).max(1_000_000),
  stopAtBudget: z.boolean(),
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

  const channels: BudgetChannel[] = ["AI", "EMAIL", "VOICE", "WHATSAPP", "TOTAL_OUTREACH"];
  const budgets: Record<string, Budget> = {};

  for (const channel of channels) {
    budgets[channel] = await getBudget(channel);
  }

  return NextResponse.json({ ok: true, budgets });
}

export async function POST(req: NextRequest) {
  const { uid, role, isAdmin } = actorFromHeaders(req);
  if (!isAdmin) {
    return NextResponse.json({ ok: false, error: "forbidden_admin_only" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = SetBudgetBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { channel, limitDollars, stopAtBudget } = parsed.data;
  const result = await setBudgetLimit({ uid, role }, channel, { limitDollars, stopAtBudget });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason ?? "set_failed" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, budget: result.budget });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";