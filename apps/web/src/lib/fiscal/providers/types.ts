/** Internal contract. Monetary values are decimal strings, never floating point. */
export type FiscalProviderCode = "ulemo" | "vero" | "native" | "mock";
export type FiscalEnvironment = "sandbox" | "production";
export type FiscalDocumentType = "FT" | "FR" | "RC" | "NC" | "ND";
export type FiscalCapability = "issue" | "lookup" | "reconcile" | "creditNote" | "cancel" | "pdf" | "saft";
export interface FiscalTenantContext {
  readonly empresaId: string;
  readonly connectionId: string;
  readonly environment: FiscalEnvironment;
}
export interface FiscalConnection extends FiscalTenantContext {
  readonly providerCode: FiscalProviderCode;
  readonly status: "disabled" | "active";
}
export interface FiscalIssueRequest {
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly documentType: FiscalDocumentType;
  readonly issueDate: string;
  readonly currency: "AOA";
  readonly customer: { readonly name: string; readonly nif: string | null };
  readonly lines: readonly {
    readonly description: string;
    readonly quantity: string;
    readonly unitPrice: string;
    readonly taxRate: string;
    readonly exemptionCode?: string;
  }[];
  readonly expectedTotal: string;
  readonly originalDocumentId?: string;
}
export interface FiscalDocumentReference {
  readonly externalDocumentId: string;
}
export interface FiscalDocument {
  readonly externalDocumentId: string;
  readonly documentNumber: string;
  readonly documentType: FiscalDocumentType;
  readonly total: string;
  readonly currency: "AOA";
  readonly simulated: boolean;
}
export type FiscalIssueResult =
  | { readonly status: "issued"; readonly document: FiscalDocument }
  | { readonly status: "pending" | "unknown"; readonly operationId: string }
  | { readonly status: "rejected"; readonly code: string };
export type FiscalReconciliationResult = FiscalIssueResult | { readonly status: "not_found" };
export interface FiscalProvider {
  readonly code: FiscalProviderCode;
  readonly environments: readonly FiscalEnvironment[];
  readonly capabilities: readonly FiscalCapability[];
  healthCheck(context: FiscalTenantContext): Promise<{ readonly available: boolean }>;
  issue(context: FiscalTenantContext, request: FiscalIssueRequest): Promise<FiscalIssueResult>;
  getDocument(context: FiscalTenantContext, reference: FiscalDocumentReference): Promise<FiscalDocument | null>;
  reconcile(context: FiscalTenantContext, operationId: string): Promise<FiscalReconciliationResult>;
  creditNote?(context: FiscalTenantContext, request: FiscalIssueRequest & { readonly documentType: "NC"; readonly originalDocumentId: string }): Promise<FiscalIssueResult>;
  cancel?(context: FiscalTenantContext, reference: FiscalDocumentReference, reason: string, idempotencyKey: string): Promise<FiscalIssueResult>;
  getPdf?(context: FiscalTenantContext, reference: FiscalDocumentReference): Promise<Uint8Array>;
  exportSaft?(context: FiscalTenantContext, period: { readonly from: string; readonly to: string }): Promise<Uint8Array>;
}
