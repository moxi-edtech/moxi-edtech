import { createHash } from "node:crypto";
import type { FiscalDocument, FiscalDocumentReference, FiscalIssueRequest, FiscalIssueResult, FiscalProvider, FiscalReconciliationResult, FiscalTenantContext } from "./types";

/** In-memory sandbox fixture only. No network, real numbering, PDF or durable ledger. */
export class MockFiscalProvider implements FiscalProvider {
  readonly code = "mock" as const;
  readonly environments = ["sandbox"] as const;
  readonly capabilities = ["issue", "lookup", "reconcile"] as const;
  private readonly operations = new Map<string, { fingerprint: string; operationId: string; document: FiscalDocument }>();
  private readonly byOperation = new Map<string, string>();
  private readonly documents = new Map<string, FiscalDocument>();

  private key(context: FiscalTenantContext, reference: string): string {
    if (context.environment !== "sandbox" || !context.empresaId || !context.connectionId) {
      throw new Error("MOCK_SANDBOX_ONLY");
    }
    return JSON.stringify([context.empresaId, context.connectionId, reference]);
  }

  async healthCheck(context: FiscalTenantContext) {
    this.key(context, "");
    return { available: true };
  }

  async issue(context: FiscalTenantContext, request: FiscalIssueRequest): Promise<FiscalIssueResult> {
    const key = this.key(context, request.idempotencyKey);
    const operationKey = this.key(context, request.operationId);
    if (!request.idempotencyKey.trim() || !request.operationId.trim() || !request.lines.length ||
        !/^\d+\.\d{2}$/.test(request.expectedTotal)) {
      return { status: "rejected", code: "INVALID_MOCK_REQUEST" };
    }
    // Stable explicit field ordering: no credentials or caller-supplied metadata.
    const fingerprint = createHash("sha256").update(JSON.stringify([
      request.operationId, request.documentType, request.issueDate, request.currency,
      request.customer.name, request.customer.nif, request.expectedTotal,
      request.originalDocumentId ?? null,
      request.lines.map(line => [line.description, line.quantity, line.unitPrice, line.taxRate, line.exemptionCode ?? null]),
    ])).digest("hex");
    const existing = this.operations.get(key);
    if (existing) {
      return existing.fingerprint === fingerprint
        ? { status: "issued", document: { ...existing.document } }
        : { status: "rejected", code: "IDEMPOTENCY_CONFLICT" };
    }
    if (this.byOperation.has(operationKey)) return { status: "rejected", code: "OPERATION_CONFLICT" };
    const id = createHash("sha256").update(key).digest("hex");
    const document: FiscalDocument = {
      externalDocumentId: "mock-" + id,
      documentNumber: "SIMULATION/" + id,
      documentType: request.documentType,
      total: request.expectedTotal,
      currency: "AOA",
      simulated: true,
    };
    this.operations.set(key, { fingerprint, operationId: request.operationId, document });
    this.byOperation.set(operationKey, key);
    this.documents.set(this.key(context, document.externalDocumentId), document);
    return { status: "issued", document: { ...document } };
  }

  async getDocument(context: FiscalTenantContext, reference: FiscalDocumentReference) {
    const document = this.documents.get(this.key(context, reference.externalDocumentId));
    return document ? { ...document } : null;
  }

  async reconcile(context: FiscalTenantContext, operationId: string): Promise<FiscalReconciliationResult> {
    const key = this.byOperation.get(this.key(context, operationId));
    const entry = key ? this.operations.get(key) : undefined;
    return entry ? { status: "issued", document: { ...entry.document } } : { status: "not_found" };
  }
}
