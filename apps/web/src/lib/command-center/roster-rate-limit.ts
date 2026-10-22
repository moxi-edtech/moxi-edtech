/**
 * Best-effort per-process limiter for the authenticated roster API.
 *
 * No extra Supabase query or polling. Does not claim distributed enforcement
 * across concurrent Vercel instances: add a shared store before treating this
 * as an abuse/security boundary. Operators must still pass backend auth/RLS.
 */
const MAX_REQUESTS_PER_WINDOW = 30;
const WINDOW_MS = 60_000;
const MAX_TRACKED_SCOPES = 500;
type Bucket = { startsAt: number; count: number };
const buckets = new Map<string, Bucket>();

export function allowRosterRequest(
  userId: string,
  escolaId: string,
  now = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } {
  if (!userId || !escolaId) return { allowed: false, retryAfterSeconds: 60 };
  const key = `${userId}:${escolaId}`;
  const previous = buckets.get(key);
  const active = previous && now - previous.startsAt < WINDOW_MS ? previous : null;
  const bucket: Bucket = active
    ? { startsAt: active.startsAt, count: active.count + 1 }
    : { startsAt: now, count: 1 };
  buckets.delete(key);
  buckets.set(key, bucket);
  for (const [storedKey, storedValue] of buckets) {
    if (now - storedValue.startsAt >= WINDOW_MS) buckets.delete(storedKey);
  }
  while (buckets.size > MAX_TRACKED_SCOPES) {
    const oldest = buckets.keys().next().value;
    if (!oldest) break;
    buckets.delete(oldest);
  }
  return {
    allowed: bucket.count <= MAX_REQUESTS_PER_WINDOW,
    retryAfterSeconds: bucket.count <= MAX_REQUESTS_PER_WINDOW
      ? 0 : Math.max(1, Math.ceil((WINDOW_MS - (now - bucket.startsAt)) / 1000)),
  };
}
