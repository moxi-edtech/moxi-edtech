import "server-only";

type FiscalProviderConfig = {
  provider: "kuantu" | "generic";
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
};

export type FiscalProviderEmitRequest = {
  idempotencyKey: string;
  escolaId: string;
  payload: Record<string, unknown>;
};

export type FiscalProviderEmitResponse = {
  providerDocumentId: string;
  providerStatus: string;
  grandTotal: string;
  taxTotal: string;
  hashControl?: string | null;
  raw: unknown;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function structuredLog(event: string, data: Record<string, unknown>) {
  console.info(JSON.stringify({ scope: "fiscal_provider", event, ...data }));
}

export class FiscalProvider {
  private readonly cfg: Required<FiscalProviderConfig>;

  constructor(config: FiscalProviderConfig) {
    this.cfg = {
      timeoutMs: 8000,
      maxRetries: 3,
      backoffBaseMs: 300,
      ...config,
    };
  }

  async emitirDocumento(req: FiscalProviderEmitRequest): Promise<FiscalProviderEmitResponse> {
    const endpoint = `${this.cfg.baseUrl.replace(/\/$/, "")}/documentos`;

    for (let attempt = 0; attempt <= this.cfg.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
      const started = Date.now();

      try {
        structuredLog("request", {
          provider: this.cfg.provider,
          escola_id: req.escolaId,
          idempotency_key: req.idempotencyKey,
          attempt,
        });

        const response = await fetch(endpoint, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.cfg.apiKey}`,
            "x-idempotency-key": req.idempotencyKey,
            "x-escola-id": req.escolaId,
          },
          body: JSON.stringify(req.payload),
          cache: "no-store",
        });

        const json = await response.json().catch(() => null);
        const latency = Date.now() - started;

        if (!response.ok) {
          structuredLog("response_error", {
            provider: this.cfg.provider,
            attempt,
            status: response.status,
            latency_ms: latency,
          });

          if (attempt < this.cfg.maxRetries && isRetryable(response.status)) {
            await sleep(this.cfg.backoffBaseMs * (2 ** attempt));
            continue;
          }

          throw new Error(
            `FISCAL_PROVIDER_HTTP_${response.status}:${(json as { error?: string } | null)?.error ?? "unknown"}`
          );
        }

        const data = json as Record<string, unknown> | null;
        const providerDocumentId = String(data?.documento_id ?? data?.id ?? "");
        const grandTotal = String(data?.total_bruto ?? data?.grand_total ?? "0.0000");
        const taxTotal = String(data?.total_impostos ?? data?.tax_total ?? "0.0000");

        if (!providerDocumentId) throw new Error("FISCAL_PROVIDER_INVALID_RESPONSE:missing_document_id");

        structuredLog("response_ok", {
          provider: this.cfg.provider,
          attempt,
          latency_ms: latency,
          provider_document_id: providerDocumentId,
        });

        return {
          providerDocumentId,
          providerStatus: String(data?.status ?? "emitido"),
          grandTotal,
          taxTotal,
          hashControl: data?.hash_control ? String(data.hash_control) : null,
          raw: json,
        };
      } catch (error) {
        const latency = Date.now() - started;
        const message = error instanceof Error ? error.message : "unknown";

        structuredLog("request_exception", {
          provider: this.cfg.provider,
          attempt,
          latency_ms: latency,
          error: message,
        });

        if (attempt >= this.cfg.maxRetries) throw error;
        await sleep(this.cfg.backoffBaseMs * (2 ** attempt));
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error("FISCAL_PROVIDER_UNREACHABLE");
  }
}
