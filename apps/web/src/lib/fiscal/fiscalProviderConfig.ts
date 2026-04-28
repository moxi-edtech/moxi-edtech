import "server-only";

import { FiscalProvider } from "@/lib/fiscal/fiscalProvider";

export function buildFiscalProviderFromEnv() {
  const provider = (process.env.FISCAL_PROVIDER_NAME?.trim().toLowerCase() || "kuantu") as
    | "kuantu"
    | "generic";
  const baseUrl = process.env.FISCAL_PROVIDER_BASE_URL?.trim();
  const apiKey = process.env.FISCAL_PROVIDER_API_KEY?.trim();

  if (!baseUrl) throw new Error("FISCAL_PROVIDER_CONFIG_MISSING_BASE_URL");
  if (!apiKey) throw new Error("FISCAL_PROVIDER_CONFIG_MISSING_API_KEY");

  return new FiscalProvider({
    provider,
    baseUrl,
    apiKey,
    timeoutMs: Number(process.env.FISCAL_PROVIDER_TIMEOUT_MS ?? 8000),
    maxRetries: Number(process.env.FISCAL_PROVIDER_MAX_RETRIES ?? 3),
    backoffBaseMs: Number(process.env.FISCAL_PROVIDER_BACKOFF_MS ?? 300),
  });
}
