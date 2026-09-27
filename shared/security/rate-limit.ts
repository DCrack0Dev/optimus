type Bucket = {
  tokens: number;
  last: number;
};

type Key = string;

const globalBuckets = new Map<Key, Bucket>();

function windowMsFor(endpoint: string): number {
  if (endpoint.startsWith("/api/website-events")) return 60 * 1000;
  if (endpoint.startsWith("/api/auth/")) return 60 * 1000;
  if (endpoint.startsWith("/api/email/send")) return 60 * 1000;
  if (endpoint.startsWith("/api/whatsapp/send")) return 60 * 1000;
  if (endpoint.startsWith("/api/calls/initiate")) return 60 * 1000;
  return 60 * 1000;
}

function windowMaxRequests(endpoint: string): number {
  if (endpoint.startsWith("/api/website-events")) return 30;
  if (endpoint.startsWith("/api/auth/login")) return 10;
  if (endpoint.startsWith("/api/email/send")) return 60;
  if (endpoint.startsWith("/api/whatsapp/send")) return 30;
  if (endpoint.startsWith("/api/calls/initiate")) return 15;
  if (endpoint.startsWith("/api/bookings/public")) return 10;
  if (endpoint.startsWith("/api/quote")) return 15;
  return 60;
}

export function rateLimitCheck(
  endpoint: string,
  identities: string[],
  opts?: { refillPerMinute?: number; maxTokens?: number }
): { ok: boolean; retryAfterMs?: number; remaining?: number } {
  const key = `${endpoint}::${identities.filter(Boolean).join("::")}`;
  const now = Date.now();
  const windowMs = windowMsFor(endpoint);
  const maxTokens = opts?.maxTokens ?? windowMaxRequests(endpoint);
  const refillPerMs =
    opts?.refillPerMinute != null
      ? opts.refillPerMinute / 60000
      : maxTokens / windowMs;
  let bucket: Bucket = globalBuckets.get(key) ?? { tokens: maxTokens, last: now };
  const deltaMs = now - bucket.last;
  if (deltaMs > 0) {
    bucket.tokens = Math.min(maxTokens, bucket.tokens + deltaMs * refillPerMs);
    bucket.last = now;
  }
  if (bucket.tokens < 1) {
    const needed = 1 - bucket.tokens;
    const retry = Math.ceil(needed / refillPerMs);
    globalBuckets.set(key, bucket);
    return { ok: false, retryAfterMs: Math.max(1, retry), remaining: 0 };
  }
  bucket.tokens -= 1;
  globalBuckets.set(key, bucket);
  return { ok: true, remaining: Math.floor(bucket.tokens) };
}

// Scheduled prune to prevent memory growth
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [k, b] of Array.from(globalBuckets.entries())) {
    if (b.last < cutoff) globalBuckets.delete(k);
  }
}, 5 * 60 * 1000).unref?.();

export function pruneBucketsForTest(): void {
  globalBuckets.clear();
}

/*
 * Upstash-compatible replacement path later:
 * - Swap implementation in this file to call Upstash Redis `incr(key, {ex: windowSec})` with NX/PEXPIRE
 * - Same return signature {ok,retryAfterMs,remaining}
 * - All middleware call sites continue to work unchanged.
 */
