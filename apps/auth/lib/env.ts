export function normalizeEnvValue(raw: string | undefined | null) {
  return String(raw ?? "")
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .replace(/\\n/g, "")
    .trim();
}

export function readEnv(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const normalized = normalizeEnvValue(value);
    if (normalized) return normalized;
  }
  return "";
}

