import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getLLMProvider } from "@optimus/lib/providers";
import { runOptimusTurn } from "@optimus/lib/ai/optimus/brain";
import type { Uid } from "@shared/types";

const RunBody = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(10000),
  voiceMode: z.boolean().optional(),
});

function actorFromHeaders(req: NextRequest): { uid: Uid; isAdmin: boolean } {
  const uid = (req.headers.get("x-auth-uid") ?? "SYSTEM") as Uid;
  const isAdmin = req.headers.get("x-auth-admin") === "1";
  return { uid, isAdmin };
}

export async function POST(req: NextRequest) {
  const { uid, isAdmin } = actorFromHeaders(req);
  if (!isAdmin && uid !== "SYSTEM") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const provider = getLLMProvider();
  if (!provider) {
    return NextResponse.json({ ok: false, error: "LLM provider not configured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = RunBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await runOptimusTurn({
      conversationId: parsed.data.conversationId,
      userId: uid,
      initialMessage: parsed.data.message,
      voiceMode: parsed.data.voiceMode,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: "optimus_error", detail: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";