import { NextResponse, type NextRequest } from "next/server";
import { runAutomationRunner } from "@optimus/lib/ai/optimus/brain";
import { writeAudit } from "@optimus/lib/audit/writer";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  if (!CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "");

  if (!providedSecret || providedSecret !== CRON_SECRET) {
    await writeAudit({
      actorUid: "SYSTEM",
      event: "AI_TOOL_CALL",
      detail: "Invalid CRON_SECRET provided to /api/jobs/run",
      data: { path: "/api/jobs/run" },
    });
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const result = await runAutomationRunner();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeAudit({
      actorUid: "SYSTEM",
      event: "AI_TOOL_CALL",
      detail: `Automation runner error: ${message}`,
      data: { error: message },
    });
    return NextResponse.json(
      { ok: false, error: "Automation runner failed", detail: message },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";