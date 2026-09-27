export const SESSION_COOKIE_NAME = "session";

export const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;
export const SESSION_REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;

export function looksLikeSessionCookie(value: string | undefined | null): boolean {
  if (!value) return false;
  if (value.length < 16) return false;
  if (value.includes(" ") || value.includes("\n") || value.includes("\t")) return false;
  return true;
}

export type LightSession = {
  role: "admin" | "client" | "staff" | "agent";
  adminClaims: boolean;
};

const ADMIN_HINT_PREFIX = "role_admin:";
const CLIENT_HINT_PREFIX = "role_client:";

export function encodeHintedRole(sessionValue: string, role: "admin" | "client" | "staff" | "agent"): string {
  if (sessionValue.startsWith(ADMIN_HINT_PREFIX) || sessionValue.startsWith(CLIENT_HINT_PREFIX)) {
    return sessionValue;
  }
  if (role === "admin") return `${ADMIN_HINT_PREFIX}${sessionValue}`;
  if (role === "client") return `${CLIENT_HINT_PREFIX}${sessionValue}`;
  if (role === "staff") return `role_staff:${sessionValue}`;
  return `role_agent:${sessionValue}`;
}

export function decodeHintedRole(sessionValue: string | undefined | null): LightSession | null {
  if (!looksLikeSessionCookie(sessionValue)) return null;
  const v = sessionValue as string;
  if (v.startsWith(ADMIN_HINT_PREFIX)) {
    return { role: "admin", adminClaims: true };
  }
  if (v.startsWith(CLIENT_HINT_PREFIX)) {
    return { role: "client", adminClaims: false };
  }
  if (v.startsWith("role_staff:")) {
    return { role: "staff", adminClaims: false };
  }
  if (v.startsWith("role_agent:")) {
    return { role: "agent", adminClaims: false };
  }
  return null;
}

export function stripRolePrefix(sessionValue: string): string {
  if (sessionValue.startsWith(ADMIN_HINT_PREFIX)) return sessionValue.slice(ADMIN_HINT_PREFIX.length);
  if (sessionValue.startsWith(CLIENT_HINT_PREFIX)) return sessionValue.slice(CLIENT_HINT_PREFIX.length);
  if (sessionValue.startsWith("role_staff:")) return sessionValue.slice("role_staff:".length);
  if (sessionValue.startsWith("role_agent:")) return sessionValue.slice("role_agent:".length);
  return sessionValue;
}
