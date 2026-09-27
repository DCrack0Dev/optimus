import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { runAgentTurn } from "@optimus/lib/ai/brain";
import type { LeadId, Uid, UserRole } from "@shared/types";

const BodySchema = z.object({
  leadId: z.string().min(1).max(128),
  trigger: z.string().min(1).max(100),
  initialMessage: z.string().max(5000).optional(),
  conversationId: z.string().min(1).max(128).optional(),
});

function actorFromHeaders(req: NextRequest): { uid: Uid; role: UserRole; isAdmin: boolean } {
  const role = (req.headers.get("x-auth-role") ?? "client") as UserRole;
  const isAdmin = req.headers.get("x-auth-admin") === "1" || role === "admin";
  const uid = (req.headers.get("x-auth-uid") ?? "SYSTEM") as Uid;
  return { uid, role, isAdmin };
}

export async function POST(req: NextRequest) {
  try {
    const actor = actorFromHeaders(req);
    if (!actor.isAdmin) {
      return NextResponse.json({ ok: false, error: "forbidden_admin" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "invalid_payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await runAgentTurn({
      leadId: parsed.data.leadId as LeadId,
      trigger: parsed.data.trigger,
      initialMessage: parsed.data.initialMessage,
      conversationId: parsed.data.conversationId as any,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: "agent_failed", detail: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";