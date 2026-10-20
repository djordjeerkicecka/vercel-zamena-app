/**
 * Minimal in-memory rate limiter, sufficient for a single Vercel serverless instance
 * under moderate load. Not distributed — resets on cold start / redeploy, and doesn't
 * share state across concurrently running instances. Fine for the order-lookup endpoint;
 * swap for a Redis-backed limiter (e.g. Upstash) if abuse becomes an issue.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  if (existing.count >= maxAttempts) {
    return { allowed: false, remaining: 0 };
  }

  existing.count += 1;
  return { allowed: true, remaining: maxAttempts - existing.count };
}

// Periodically sweep expired buckets so the map doesn't grow unbounded over the lifetime
// of a long-lived serverless instance.
let lastSweep = Date.now();
export function sweepExpiredBuckets() {
  const now = Date.now();
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
