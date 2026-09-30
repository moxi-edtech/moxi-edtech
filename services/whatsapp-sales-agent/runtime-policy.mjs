const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function followUpHoursFromEnv(value) {
  const parsed = Number(value ?? 24);
  return Number.isFinite(parsed) ? Math.max(1, parsed) : 24;
}

export function buildFollowUpDelaysMs(followUpHours) {
  const initial = followUpHoursFromEnv(followUpHours) * HOUR_MS;
  return [
    initial,
    Math.max(initial, 48 * HOUR_MS),
    Math.max(initial, 72 * HOUR_MS),
    Math.max(initial, 7 * DAY_MS),
    Math.max(initial, 30 * DAY_MS),
    Math.max(initial, 60 * DAY_MS),
    Math.max(initial, 90 * DAY_MS),
  ];
}

export function buildAiRuntimeConfig(env = process.env) {
  const provider = String(env.AI_PROVIDER || "gemini").trim().toLowerCase();
  const key = String(env.AI_API_KEY || "").trim();
  const model = String(env.AI_MODEL || (provider === "deepseek" ? "deepseek-chat" : "gemini-2.5-flash")).trim();
  const fallbackProvider = String(env.AI_FALLBACK_PROVIDER || "gemini").trim().toLowerCase();
  const fallbackKey = String(env.AI_FALLBACK_API_KEY || "").trim();
  const fallbackModel = String(env.AI_FALLBACK_MODEL || (fallbackProvider === "deepseek" ? "deepseek-chat" : "gemini-2.5-flash")).trim();
  return { provider, key, model, fallbackProvider, fallbackKey, fallbackModel };
}
