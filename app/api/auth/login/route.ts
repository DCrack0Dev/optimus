import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getAdminAuth, getAdminDb, isAdminConfigured } from "@optimus/lib/firebase/admin";
import type { UserRole } from "@shared/types";
import {
  createOptimusSessionCookie,
  setOptimusSessionCookieUsingStore,
  OPTIMUS_SESSION_DURATION_MS
} from "@optimus/lib/auth/session";

const BodySchema = z.object({
  idToken: z.string().min(1).max(4096),
  remember: z.boolean().optional().default(false),
  email: z.string().max(255).optional(),
  password: z.string().max(255).optional()
});

function pickRole(...candidates: Array<UserRole | undefined>): UserRole {
  const order: Array<UserRole> = ["admin", "staff", "agent", "client"];
  for (const r of order) if (candidates.includes(r)) return r;
  return "client";
}

function bypassAdminAuth(
  email: string | undefined,
  password: string | undefined
): { ok: boolean; role: UserRole; uid: string; email: string } | null {
  const user = process.env.OPTIMUS_BYPASS_ADMIN_USER;
  const pass = process.env.OPTIMUS_BYPASS_ADMIN_PASSWORD;
  if (!user || !pass) return null;
  if (!email || !password) return null;
  const userIn = email.trim();
  const userCfg = user.trim();
  if (userIn.toLowerCase() !== userCfg.toLowerCase() || password !== pass) return null;
  return {
    ok: true,
    role: "admin",
    uid: "optimus-local-admin",
    email: userCfg
  };
}

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
    const { idToken, remember, email, password } = parse.data;
    const store = cookies();

    let uid: string | null = null;
    let userEmail: string | null = null;
    let verifiedRole: UserRole = "client";
    let sessionIdToken = idToken;

    const bypass = bypassAdminAuth(email, password);
    if (bypass) {
      uid = bypass.uid;
      userEmail = bypass.email;
      verifiedRole = bypass.role;
      sessionIdToken = idToken || `bypass:${bypass.uid}:${Date.now()}`;
    } else if (isAdminConfigured()) {
      try {
        const auth = getAdminAuth();
        const decoded = await auth.verifyIdToken(idToken, true);
        uid = decoded.uid;
        userEmail = decoded.email ?? null;
        const claimAdmin = decoded.admin === true;
        const claimRole = decoded.role as UserRole | undefined;
        try {
          const db = getAdminDb();
          const snap = await db.collection("profiles").doc(uid).get();
          if (snap.exists) {
            const data = snap.data() as { role?: UserRole; email?: string | null } | undefined;
            const profileRole = data?.role;
            verifiedRole = pickRole(
              claimAdmin ? "admin" : undefined,
              claimRole,
              profileRole
            );
            if (!userEmail && data?.email) userEmail = data.email;
          } else {
            verifiedRole = pickRole(claimAdmin ? "admin" : undefined, claimRole);
          }
        } catch {
          verifiedRole = pickRole(claimAdmin ? "admin" : undefined, claimRole);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json(
          { ok: false, error: "invalid_id_token", detail: message },
          { status: 401 }
        );
      }
    } else {
      return NextResponse.json(
        { ok: false, error: "server_not_configured" },
        { status: 503 }
      );
    }

    if (verifiedRole !== "admin" && verifiedRole !== "staff") {
      return NextResponse.json(
        { ok: false, error: "forbidden_owner_only", uid },
        { status: 403 }
      );
    }

    const sessionRes = await createOptimusSessionCookie(sessionIdToken, remember, verifiedRole);
    setOptimusSessionCookieUsingStore(store, sessionRes.cookie, remember);

    const headers = new Headers();
    headers.set("Cache-Control", "no-store");

    const expiresMs = remember ? 30 * 24 * 60 * 60 * 1000 : OPTIMUS_SESSION_DURATION_MS;
    return NextResponse.json(
      {
        ok: true,
        uid: uid ?? "local_only",
        email: userEmail,
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
