export const DEFAULT_AI_ALLOWED_FEATURES = [
  "summary",
  "rewrite",
  "generate_communication",
  "finance_message",
] as const;

export type AiAllowedFeature = (typeof DEFAULT_AI_ALLOWED_FEATURES)[number];

export function normalizeAiAllowedFeatures(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [...DEFAULT_AI_ALLOWED_FEATURES];
  }

  const normalized = Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    )
  );

  return normalized.length > 0 ? normalized : [...DEFAULT_AI_ALLOWED_FEATURES];
}
