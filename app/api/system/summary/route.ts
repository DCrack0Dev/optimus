import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSystemMode, getSystemSettings, setMode } from "@optimus/lib/security/modes";
import { getBudget } from "@optimus/lib/budgets/engine";
import type { Uid, UserRole } from "@shared/types";
import { SystemModeSchema } from "@shared/validation/schemas";

const ModeBody = z.object({ mode: SystemModeSchema, reason: z.string().max(240).nullish() });

function actorFromHeaders(req: NextRequest): { uid: Uid | "SYSTEM"; role: UserRole | null; isAdmin: boolean } {
  const role = (req.headers.get("x-auth-role") ?? "client") as UserRole;
  const isAdmin = req.headers.get("x-auth-admin") === "1" || role === "admin";
  const uid = (req.headers.get("x-auth-uid") ?? "SYSTEM") as Uid | "SYSTEM";
  return { uid, role, isAdmin };
}

export async function GET(_req: NextRequest) {
  const [settings, mode, budgets] = await Promise.all([
    getSystemSettings(),
    getSystemMode(),
    Promise.all((["AI", "EMAIL", "VOICE", "WHATSAPP", "TOTAL_OUTREACH"] as const).map(async (c) => ({
      channel: c,
      budget: await getBudget(c)
    })))
  ]);
  return NextResponse.json(
    {
      ok: true,
      mode: mode.mode,
      emergencyStop: mode.emergencyStop,
      settings,
      budgets: Object.fromEntries(budgets.map((b) => [b.channel, b.budget]))
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const actor = actorFromHeaders(req);
    if (!actor.isAdmin || actor.role !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden_admin" }, { status: 403 });
    }
    const raw = await req.json();
    const parse = ModeBody.safeParse(raw);
    if (!parse.success) {
      return NextResponse.json({ ok: false, error: "invalid_body", issues: parse.error.issues }, { status: 400 });
    }
    const r = await setMode(
      { uid: actor.uid as Uid, role: actor.role ?? "admin" },
      parse.data.mode,
      { reason: parse.data.reason ?? null }
    );
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: r.reason ?? "mode_failed" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, mode: r.mode }, { status: 200 });
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
