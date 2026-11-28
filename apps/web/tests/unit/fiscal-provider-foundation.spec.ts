import assert from "node:assert/strict";
import { test } from "node:test";
import { FiscalProviderRegistry, FiscalResolutionError } from "../../src/lib/fiscal/providers/registry";
import { MockFiscalProvider } from "../../src/lib/fiscal/providers/mock.adapter";
import type { FiscalConnection, FiscalIssueRequest } from "../../src/lib/fiscal/providers/types";

const connection: FiscalConnection = { empresaId: "company-a", connectionId: "connection-a", providerCode: "mock", environment: "sandbox", status: "active" };
const input = { empresaId: connection.empresaId, connectionId: connection.connectionId, environment: "sandbox", capability: "issue", connection } as const;
const request: FiscalIssueRequest = {
  operationId: "op-1", idempotencyKey: "key-1", documentType: "FR", issueDate: "2026-11-24", currency: "AOA",
  customer: { name: "Test", nif: null }, lines: [{ description: "Tuition", quantity: "1", unitPrice: "100.00", taxRate: "0" }], expectedTotal: "100.00",
};
function setup() {
  const mock = new MockFiscalProvider();
  return { mock, registry: new FiscalProviderRegistry([mock]) };
}
function code(expected: string) {
  return (error: unknown) => error instanceof FiscalResolutionError && error.code === expected;
}
test("resolves explicit sandbox connection", () => {
  const { mock, registry } = setup();
  assert.equal(registry.resolve(input).provider, mock);
});
test("fails closed for tenant, connection, environment, disabled, production and unknown provider", () => {
  const { registry } = setup();
  assert.throws(() => registry.resolve({ ...input, empresaId: "other" }), code("TENANT_MISMATCH"));
  assert.throws(() => registry.resolve({ ...input, connectionId: "other" }), code("CONNECTION_MISMATCH"));
  assert.throws(() => registry.resolve({ ...input, environment: "production" }), code("ENVIRONMENT_MISMATCH"));
  assert.throws(() => registry.resolve({ ...input, connection: { ...connection, status: "disabled" } }), code("CONNECTION_DISABLED"));
  assert.throws(() => registry.resolve({ ...input, environment: "production", connection: { ...connection, environment: "production" } }), code("PRODUCTION_DISABLED"));
  assert.throws(() => registry.resolve({ ...input, connection: { ...connection, providerCode: "ulemo" } }), code("PROVIDER_UNAVAILABLE"));
  assert.throws(() => registry.resolve({ ...input, capability: "pdf" }), code("CAPABILITY_UNSUPPORTED"));
});
test("duplicate registrations rejected", () => {
  const { mock } = setup();
  assert.throws(() => new FiscalProviderRegistry([mock, mock]), code("DUPLICATE_PROVIDER"));
});
test("same operation concurrently returns same simulated document, conflicting payload rejected", async () => {
  const { mock } = setup();
  const [first, second] = await Promise.all([mock.issue(connection, request), mock.issue(connection, request)]);
  assert.equal(first.status, "issued");
  assert.deepEqual(first, second);
  if (first.status !== "issued") throw new Error("Expected simulated issuance");
  assert.equal(first.document.simulated, true);
  assert.deepEqual(await mock.issue(connection, { ...request, expectedTotal: "200.00" }), { status: "rejected", code: "IDEMPOTENCY_CONFLICT" });
  assert.deepEqual(await mock.issue(connection, { ...request, idempotencyKey: "different" }), { status: "rejected", code: "OPERATION_CONFLICT" });
  assert.deepEqual(await mock.reconcile(connection, request.operationId), first);
});
test("mock isolates tenants and connections and refuses direct production use", async () => {
  const { mock } = setup();
  const first = await mock.issue(connection, request);
  if (first.status !== "issued") throw new Error("Expected simulated issuance");
  for (const other of [{ ...connection, empresaId: "company-b" }, { ...connection, connectionId: "connection-b" }]) {
    assert.equal(await mock.getDocument(other, first.document), null);
    assert.deepEqual(await mock.reconcile(other, request.operationId), { status: "not_found" });
    assert.notDeepEqual(await mock.issue(other, request), first);
  }
  await assert.rejects(mock.issue({ ...connection, environment: "production" }, request), /MOCK_SANDBOX_ONLY/);
});
