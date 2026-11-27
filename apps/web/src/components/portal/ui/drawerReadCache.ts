// Ephemeral, per-drawer-session GET reuse. Never share across roots or identities.
type Entry = { promise: Promise<Response>; expiresAt: number };
type ReadOptions = { fresh?: boolean; signal?: AbortSignal };
function forCaller(promise: Promise<Response>, signal?: AbortSignal): Promise<Response> {
  if (!signal) return promise.then(response => response.clone());
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(signal.reason); };
    signal.addEventListener("abort", abort, { once: true });
    promise.then(response => {
      signal.removeEventListener("abort", abort);
      if (!signal.aborted) resolve(response.clone());
    }, error => {
      signal.removeEventListener("abort", abort);
      reject(error);
    });
  });
}
type Options = { fetcher?: typeof fetch; now?: () => number; ttlMs?: number; maxEntries?: number };

export function createDrawerReadCache({ fetcher = fetch, now = Date.now, ttlMs = 30_000, maxEntries = 32 }: Options = {}) {
  const entries = new Map<string, Entry>();
  const invalidate = () => entries.clear();

  async function read(url: string, { fresh = false, signal }: ReadOptions = {}): Promise<Response> {
    if (signal?.aborted) throw signal.reason;
    // Explicitly opted-in, same-origin GET endpoints only. No mutation or global HTTP cache.
    if (!url.startsWith("/api/")) throw new Error("Invalid drawer read URL");
    const parsed = new URL(url, "https://drawer.invalid");
    if (parsed.origin !== "https://drawer.invalid" || !parsed.pathname.startsWith("/api/")) throw new Error("Invalid drawer read URL");
    parsed.searchParams.sort();
    const key = parsed.pathname + parsed.search;
    const existing = entries.get(key);
    if (!fresh && existing && existing.expiresAt > now()) return forCaller(existing.promise, signal);
    entries.delete(key);
    const entry: Entry = { expiresAt: Infinity, promise: Promise.resolve(null as unknown as Response) };
    entry.promise = (async () => {
      try {
        const response = await fetcher(url, { cache: "no-store" });
        const payload = response.ok ? await response.clone().json().catch(() => null) : null;
        if (entries.get(key) === entry) {
          if (response.ok && payload?.ok === true) entry.expiresAt = now() + ttlMs;
          else entries.delete(key);
        }
        return response;
      } catch (error) {
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      }
    })();
    entries.set(key, entry);
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value;
      if (oldest === undefined) break;
      entries.delete(oldest);
    }
    return forCaller(entry.promise, signal);
  }

  return { read, invalidate };
}
