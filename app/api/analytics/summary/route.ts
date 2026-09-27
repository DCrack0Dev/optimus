import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getTileSummary } from "@optimus/lib/analytics/summary";

const RangeSchema = z.enum(["7d", "30d", "90d", "custom"]).default("30d");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const range = RangeSchema.safeParse(searchParams.get("range") ?? "30d");
  const rangeDays = range.success
    ? range.data === "7d"
      ? 7
      : range.data === "30d"
      ? 30
      : range.data === "90d"
      ? 90
      : 30
    : 30;

  try {
    const tiles = await getTileSummary(rangeDays);
    return NextResponse.json({ ok: true, tiles }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: "summary_failed", detail: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";