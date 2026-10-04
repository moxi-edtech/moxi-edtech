import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { sanitizeAgtEvidence } from "@/lib/fiscal/certification/sanitizer";
import type {
  CertificationPreflight,
  CertificationTransport,
  FiscalIssueRequest,
  IssueSuccess,
  TransportOutcome,
} from "@/lib/fiscal/certification/types";

type HttpTransportOptions = {
  baseUrl: string;
  artifactDir: string;
  escolaId?: string | null;
  cookie?: string | null;
  bearer?: string | null;
  preflight: (input: { empresaId: string; year: number }) => Promise<CertificationPreflight>;
  fetchImpl?: typeof fetch;
};

function errorBody(value: unknown) {
  const safe = sanitizeAgtEvidence(value) as Record<string, unknown> | null;
  const error =
    safe && typeof safe.error === "object" && safe.error && !Array.isArray(safe.error)
      ? (safe.error as Record<string, unknown>)
      : {};
  return {
    code: String(error.code ?? (safe?.code ?? "HTTP_REJECTED")),
    message: String(error.message ?? safe?.error ?? "Pedido rejeitado."),
  };
}

export class CertificationHttpTransport implements CertificationTransport {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HttpTransportOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  preflight(input: { empresaId: string; year: number }) {
    return this.options.preflight(input);
  }

  private headers(extra?: Record<string, string>) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(extra ?? {}),
    };
    if (this.options.cookie) headers.cookie = this.options.cookie;
    if (this.options.bearer) headers.authorization = `Bearer ${this.options.bearer}`;
    if (this.options.escolaId) headers["x-escola-id"] = this.options.escolaId;
    return headers;
  }

  private url(relative: string) {
    return `${this.options.baseUrl.replace(/\/$/, "")}${relative}`;
  }

  async issue(request: FiscalIssueRequest): Promise<TransportOutcome<IssueSuccess>> {
    try {
      const response = await this.fetchImpl(this.url("/api/fiscal/documentos"), {
        method: "POST",
        headers: this.headers(),
        cache: "no-store",
        body: JSON.stringify(request),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok || !body?.data?.documento_id) {
        const parsed = errorBody(body);
        if (response.status >= 500) {
          return { kind: "uncertain", ...parsed, httpStatus: response.status };
        }
        return { kind: "rejected", ...parsed, httpStatus: response.status };
      }
      return {
        kind: "success",
        data: {
          documentoId: String(body.data.documento_id),
          numero: String(body.data.numero_formatado ?? ""),
          tipoDocumento: request.tipo_documento,
          agtSubmission: sanitizeAgtEvidence(body.agt_submission ?? null),
        },
      };
    } catch (error) {
      return {
        kind: "uncertain",
        code: "HTTP_TRANSPORT_UNCERTAIN",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async annul(input: {
    documentoId: string;
    motivo: string;
    metadata?: Record<string, unknown>;
  }): Promise<TransportOutcome<{ documentoId: string }>> {
    try {
      const response = await this.fetchImpl(
        this.url(`/api/fiscal/documentos/${input.documentoId}/anular`),
        {
          method: "POST",
          headers: this.headers(),
          cache: "no-store",
          body: JSON.stringify({
            motivo: input.motivo,
            metadata: input.metadata ?? {},
          }),
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) {
        const parsed = errorBody(body);
        if (response.status >= 500) {
          return { kind: "uncertain", ...parsed, httpStatus: response.status };
        }
        return { kind: "rejected", ...parsed, httpStatus: response.status };
      }
      return {
        kind: "success",
        data: { documentoId: input.documentoId },
      };
    } catch (error) {
      return {
        kind: "uncertain",
        code: "HTTP_ANNUL_UNCERTAIN",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async capturePdf(input: {
    documentoId: string;
    fileName: string;
    variant: "current" | "before-annulment" | "after-annulment";
  }): Promise<TransportOutcome<{ path: string; sha256: string }>> {
    try {
      const response = await this.fetchImpl(
        this.url(`/api/fiscal/documentos/${input.documentoId}/pdf`),
        {
          method: "GET",
          headers: this.headers({ accept: "application/pdf" }),
          cache: "no-store",
        }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const parsed = errorBody(body);
        return response.status >= 500
          ? { kind: "uncertain", ...parsed, httpStatus: response.status }
          : { kind: "rejected", ...parsed, httpStatus: response.status };
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      await mkdir(this.options.artifactDir, { recursive: true });
      const outputPath = path.join(this.options.artifactDir, input.fileName);
      await writeFile(outputPath, bytes);
      return {
        kind: "success",
        data: {
          path: outputPath,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      };
    } catch (error) {
      return {
        kind: "uncertain",
        code: "PDF_CAPTURE_UNCERTAIN",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async issueReceipt(input: {
    paymentId: string;
    idempotencyKey: string;
  }): Promise<TransportOutcome<IssueSuccess>> {
    try {
      const response = await this.fetchImpl(this.url("/api/financeiro/recibos/emitir"), {
        method: "POST",
        headers: this.headers({ "Idempotency-Key": input.idempotencyKey }),
        cache: "no-store",
        body: JSON.stringify({ pagamentoId: input.paymentId }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok || !body?.doc_id) {
        const parsed = errorBody(body);
        if (response.status >= 500 || response.status === 202) {
          return { kind: "uncertain", ...parsed, httpStatus: response.status };
        }
        return { kind: "rejected", ...parsed, httpStatus: response.status };
      }
      return {
        kind: "success",
        data: {
          documentoId: String(body.doc_id),
          numero: String(body.fiscal?.numero_formatado ?? ""),
          tipoDocumento: String(body.fiscal?.tipo_documento ?? "RC"),
          agtSubmission: sanitizeAgtEvidence(body.fiscal?.agt_submission ?? null),
        },
      };
    } catch (error) {
      return {
        kind: "uncertain",
        code: "RC_TRANSPORT_UNCERTAIN",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
