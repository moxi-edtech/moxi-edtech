import "server-only";

type LimitWindow = {
  count: number;
  windowMs: number;
};

type LimitRecord = {
  count: number;
  resetAt: number;
};

const inMemoryStore = new Map<string, LimitRecord>();

const LOGIN_LIMIT: LimitWindow = {
  count: Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX ?? 5),
  windowMs: Number(process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS ?? 60_000),
};

function normalizeIp(raw: string | null | undefined) {
  const ip = String(raw ?? "")
    .split(",")[0]
    .trim();
  return ip || "unknown";
}

function evaluateInMemory(key: string, limit: LimitWindow) {
  const now = Date.now();
  const record = inMemoryStore.get(key);

  if (!record || now >= record.resetAt) {
    inMemoryStore.set(key, { count: 1, resetAt: now + limit.windowMs });
    return { success: true, remaining: Math.max(0, limit.count - 1) };
  }

  record.count += 1;
  inMemoryStore.set(key, record);
  return { success: record.count <= limit.count, remaining: Math.max(0, limit.count - record.count) };
}

async function evaluateUpstash(key: string, limit: LimitWindow) {
  const restUrl = (process.env.UPSTASH_REDIS_REST_URL ?? "").trim();
  const restToken = (process.env.UPSTASH_REDIS_REST_TOKEN ?? "").trim();
  if (!restUrl || !restToken) return null;

  const redisKey = encodeURIComponent(`auth:login:${key}`);
  try {
    const incrRes = await fetch(`${restUrl}/incr/${redisKey}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${restToken}` },
      cache: "no-store",
    });
    if (!incrRes.ok) return null;
    const json = (await incrRes.json()) as { result?: number };
    const count = Number(json.result ?? 0);
    if (count === 1) {
      const ttl = Math.ceil(limit.windowMs / 1000);
      await fetch(`${restUrl}/expire/${redisKey}/${ttl}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${restToken}` },
        cache: "no-store",
      }).catch(() => null);
    }
    return { success: count <= limit.count, remaining: Math.max(0, limit.count - count) };
  } catch {
    return null;
  }
}

export async function checkLoginRateLimit(rawIp: string | null | undefined) {
  const ip = normalizeIp(rawIp);
  const key = ip;

  const fromRedis = await evaluateUpstash(key, LOGIN_LIMIT);
  if (fromRedis) return { ...fromRedis, ip };

  const fromMemory = evaluateInMemory(key, LOGIN_LIMIT);
  return { ...fromMemory, ip };
}
