import crypto from "node:crypto";

const HMAC_ALGO = "sha256";
const DEFAULT_TTL_MS = 30 * 60 * 1000;

function getSecret(): Buffer {
  const s = process.env.CSRF_SECRET ?? process.env.WEBHOOK_HMAC_SECRET ?? "";
  if (!s) {
    throw new Error("CSRF_SECRET or WEBHOOK_HMAC_SECRET env var is required");
  }
  return Buffer.from(s, "utf8");
}

export function generateCsrfToken(sessionId: string, ttlMs = DEFAULT_TTL_MS): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + ttlMs;
  const payload = `${sessionId}|${expiresAt}|${crypto.randomBytes(8).toString("hex")}`;
  const sig = crypto.createHmac(HMAC_ALGO, getSecret()).update(payload).digest("base64url");
  const token = `${Buffer.from(payload, "utf8").toString("base64url")}.${sig}`;
  return { token, expiresAt };
}

export function validateCsrfToken(sessionId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const [payloadB64, sigB64] = token.split(".") as [string] | [string, string];
  if (!payloadB64 || !sigB64) return false;
  try {
    const payload = Buffer.from(payloadB64, "base64url").toString("utf8");
    const expected = crypto.createHmac(HMAC_ALGO, getSecret()).update(payload).digest("base64url");
    const a = Buffer.from(sigB64, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    if (!crypto.timingSafeEqual(a, b)) return false;
    const parts = payload.split("|");
    if (parts.length !== 3) return false;
    const [sid, expiresRaw] = parts as [string, string, string];
    if (sid !== sessionId) return false;
    const expires = Number(expiresRaw);
    if (!Number.isFinite(expires)) return false;
    return expires > Date.now();
  } catch {
    return false;
  }
}

export function validateHeaderCsrf(req: { headers: { get(name: string): string | null } }, sessionId: string): boolean {
  const header = req.headers.get("x-csrf-token");
  const form = req.headers.get("x-dtws-csrf");
  return validateCsrfToken(sessionId, header ?? form ?? null);
}
