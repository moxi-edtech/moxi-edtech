import "server-only";

import { FiscalProvider } from "@/lib/fiscal/fiscalProvider";
import { parseSafeInteger } from "@/lib/fiscal/decimal";

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
    timeoutMs: parseSafeInteger(
      process.env.FISCAL_PROVIDER_TIMEOUT_MS ?? "8000",
      "FISCAL_PROVIDER_TIMEOUT_MS",
      { min: 1000, fallback: 8000 }
    ),
    maxRetries: parseSafeInteger(
      process.env.FISCAL_PROVIDER_MAX_RETRIES ?? "3",
      "FISCAL_PROVIDER_MAX_RETRIES",
      { min: 0, max: 20, fallback: 3 }
    ),
    backoffBaseMs: parseSafeInteger(
      process.env.FISCAL_PROVIDER_BACKOFF_MS ?? "300",
      "FISCAL_PROVIDER_BACKOFF_MS",
      { min: 1, fallback: 300 }
    ),
  });
}
