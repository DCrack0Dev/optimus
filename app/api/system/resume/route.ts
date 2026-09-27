import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resumeSystem } from "@optimus/lib/security/modes";
import type { Uid, UserRole } from "@shared/types";

const ResumeBody = z.object({ reason: z.string().max(240).nullish() });

function actorFromHeaders(req: NextRequest): { uid: Uid; role: UserRole | null; isAdmin: boolean } {
  const role = (req.headers.get("x-auth-role") ?? "client") as UserRole;
  const isAdmin = req.headers.get("x-auth-admin") === "1" || role === "admin";
  const uid = (req.headers.get("x-auth-uid") ?? "") as Uid;
  return { uid, role, isAdmin };
}

export async function POST(req: NextRequest) {
  try {
    const actor = actorFromHeaders(req);
    if (!actor.isAdmin || actor.role !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden_admin" }, { status: 403 });
    }
    const raw = await req.json().catch(() => ({}));
    const parse = ResumeBody.safeParse(raw ?? {});
    const reason = parse.success ? parse.data.reason ?? null : null;
    const r = await resumeSystem(
      { uid: actor.uid, role: actor.role ?? "client" },
      { reason }
    );
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: r.reason ?? "resume_failed" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, resumed: Boolean(r.resumed) }, { status: 200 });
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
