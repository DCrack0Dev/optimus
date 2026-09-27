import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getAdminAuth, isAdminConfigured } from "@optimus/lib/firebase/admin";
import type { UserRole } from "@shared/types";
import {
  createOptimusSessionCookie,
  setOptimusSessionCookieUsingStore,
  OPTIMUS_SESSION_DURATION_MS
} from "@optimus/lib/auth/session";

const BodySchema = z.object({
  idToken: z.string().min(1).max(4096),
  remember: z.boolean().optional().default(false)
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parse = BodySchema.safeParse(raw);
    if (!parse.success) {
      return NextResponse.json(
        { ok: false, error: "invalid_body", issues: parse.error.issues },
        { status: 400 }
      );
    }
    const { idToken, remember } = parse.data;
    const store = cookies();

    let uid: string | null = null;
    let email: string | null = null;
    let verifiedRole: UserRole = "client";

    if (isAdminConfigured()) {
      try {
        const auth = getAdminAuth();
        const decoded = await auth.verifyIdToken(idToken, true);
        uid = decoded.uid;
        email = decoded.email ?? null;
        if (decoded.admin === true) verifiedRole = "admin";
        const claimRole = decoded.role as UserRole | undefined;
        if (
          claimRole === "admin" ||
          claimRole === "staff" ||
          claimRole === "agent" ||
          claimRole === "client"
        ) {
          verifiedRole = claimRole;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { ok: false, error: "invalid_id_token", detail: message },
          { status: 401 }
        );
      }
    }

    // Optimus authorization gate: admin or staff only.
    if (verifiedRole !== "admin" && verifiedRole !== "staff") {
      return NextResponse.json(
        { ok: false, error: "forbidden_owner_only" },
        { status: 403 }
      );
    }

    const sessionRes = await createOptimusSessionCookie(idToken, remember, verifiedRole);
    setOptimusSessionCookieUsingStore(store, sessionRes.cookie, remember);

    const headers = new Headers();
    headers.set("Cache-Control", "no-store");

    const expiresMs = remember ? 30 * 24 * 60 * 60 * 1000 : OPTIMUS_SESSION_DURATION_MS;
    return NextResponse.json(
      {
        ok: true,
        uid: uid ?? "local_only",
        email,
        role: sessionRes.role,
        cookieSet: true,
        expiresAt: Date.now() + expiresMs
      },
      { status: 200, headers }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: "internal", detail: process.env.NODE_ENV === "production" ? undefined : message },
      { status: 500 }
    );
  }
}
