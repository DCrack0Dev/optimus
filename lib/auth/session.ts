import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { getAdminAuth, isAdminConfigured } from "@optimus/lib/firebase/admin";
import type { Uid, UserRole } from "@shared/types";
import { getAdminDb } from "@optimus/lib/firebase/admin";
import {
  encodeHintedRole,
  stripRolePrefix
} from "@shared/auth/session-edge";

export {
  SESSION_COOKIE_NAME as WEBSITE_SESSION_COOKIE_NAME,
  SESSION_DURATION_MS as WEBSITE_SESSION_DURATION_MS,
  SESSION_REMEMBER_MS as WEBSITE_SESSION_REMEMBER_MS
} from "@shared/auth/session-edge";

export const OPTIMUS_SESSION_COOKIE_NAME = "optimus_session";
export const OPTIMUS_SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;
export const OPTIMUS_SESSION_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;
export const OPTIMUS_ALLOWED_ROLES: ReadonlyArray<UserRole> = ["admin", "staff"];

function getOptimusCookieOptions() {
  const secure = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/"
  };
}

function inferRoleFromClaimsAndProfile(decoded: { uid: string; admin?: unknown; role?: unknown; email?: string | null }): Promise<UserRole> {
  return new Promise((resolve) => {
    let role: UserRole = "client";
    if (decoded.admin === true) role = "admin";
    const claimRole = decoded.role as UserRole | undefined;
    if (
      claimRole === "admin" ||
      claimRole === "staff" ||
      claimRole === "agent" ||
      claimRole === "client"
    ) {
      role = claimRole;
    }
    if (!isAdminConfigured()) {
      resolve(role);
      return;
    }
    const db = getAdminDb();
    db.collection("profiles")
      .doc(decoded.uid)
      .get()
      .then((snap) => {
        if (snap.exists) {
          const data = snap.data() as { role?: unknown } | undefined;
          const candidate = data?.role as UserRole | undefined;
          if (
            candidate === "admin" ||
            candidate === "staff" ||
            candidate === "agent" ||
            candidate === "client"
          ) {
            role = candidate;
          }
        }
        resolve(role);
      })
      .catch(() => resolve(role));
  });
}

export async function createOptimusSessionCookie(
  idToken: string,
  remember = false,
  explicitRole?: UserRole
): Promise<{ cookie: string; role: UserRole }> {
  let role: UserRole = explicitRole ?? "client";
  if (isAdminConfigured()) {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken, true);
    if (!explicitRole) {
      role = await inferRoleFromClaimsAndProfile(decoded);
    }
  }
  if (!OPTIMUS_ALLOWED_ROLES.includes(role)) {
    role = "client";
  }
  let raw: string;
  if (!isAdminConfigured()) {
    const REQUIRED_CHAR = (process.env.SESSION_SECRET?.length ?? 0) + role.length;
    raw = `devoptimus_${idToken.slice(0, 32)}_${REQUIRED_CHAR}`;
  } else {
    const auth = getAdminAuth();
    const duration = remember ? OPTIMUS_SESSION_REMEMBER_MS : OPTIMUS_SESSION_DURATION_MS;
    raw = await auth.createSessionCookie(idToken, { expiresIn: duration });
  }
  return { cookie: encodeHintedRole(raw, role), role };
}

export type VerifiedOptimusSession = {
  uid: Uid;
  email: string | null;
  role: UserRole;
  adminClaims: boolean;
};

export async function verifyOptimusSessionCookie(
  cookieValue: string
): Promise<VerifiedOptimusSession | null> {
  if (!cookieValue) return null;
  const raw = stripRolePrefix(cookieValue);
  if (!raw) return null;
  if (!isAdminConfigured()) {
    if (raw.startsWith("devoptimus_")) {
      const isAdmin = cookieValue.startsWith("role_admin:") || cookieValue.startsWith("role_staff:");
      return {
        uid: "dev_optimus" as Uid,
        email: null,
        role: isAdmin ? "admin" : "client",
        adminClaims: isAdmin
      };
    }
    return null;
  }
  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifySessionCookie(raw, true);
    const role = await inferRoleFromClaimsAndProfile(decoded);
    const adminClaims = Boolean(decoded.admin) || role === "admin" || role === "staff";
    return {
      uid: decoded.uid as Uid,
      email: decoded.email ?? null,
      role,
      adminClaims
    };
  } catch {
    return null;
  }
}

export function setOptimusSessionCookieUsingStore(
  store: {
    set: (
      name: string,
      value: string,
      options?: {
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: "strict" | "lax" | "none";
        path?: string;
        expires?: Date;
        maxAge?: number;
      }
    ) => void;
  },
  sessionCookie: string,
  remember = false
): void {
  const duration = remember ? OPTIMUS_SESSION_REMEMBER_MS : OPTIMUS_SESSION_DURATION_MS;
  const opts = getOptimusCookieOptions();
  store.set(OPTIMUS_SESSION_COOKIE_NAME, sessionCookie, {
    ...opts,
    expires: new Date(Date.now() + duration),
    maxAge: Math.floor(duration / 1000)
  });
}

export function clearOptimusSessionCookieUsingStore(store: {
  set: (
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "strict" | "lax" | "none";
      path?: string;
      expires?: Date;
      maxAge?: number;
    }
  ) => void;
}): void {
  const opts = getOptimusCookieOptions();
  store.set(OPTIMUS_SESSION_COOKIE_NAME, "", { ...opts, expires: new Date(0), maxAge: 0 });
}

export function getOptimusSessionCookieValue(
  store: ReadonlyRequestCookies
): string | undefined {
  return store.get(OPTIMUS_SESSION_COOKIE_NAME)?.value;
}
