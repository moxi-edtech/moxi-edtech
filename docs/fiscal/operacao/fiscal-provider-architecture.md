# Fiscal Provider — foundation (ADR proposal)

Status: sandbox-only, disconnected. No production change, migrations, financial writes or vendor calls. Preserve the AGT certification branch independently.

## Boundaries

The KLASSE financial ledger remains authoritative for payments, tuition, balances and scholarships. Fiscal company (empresa_id) remains the fiscal tenant; resolve the existing school-company binding and authorization server-side. Never trust a caller-supplied connection, company or credential. The external certified provider owns official numbering, signature, lifecycle and fiscal artifacts. The native engine retains its existing invariants. Do not insert external documents into its signed ledger or generate replacement official PDFs.

## Foundation

Contract and explicit registry under apps/web/src/lib/fiscal/providers. No default provider, fallback, environment override or production activation. Mock is deterministic, in-memory and clearly simulated; its idempotency is only a fixture, not a durable guarantee or fiscal calculation. Unknown provider codes have no adapter. Optional lifecycle operations require declared and implemented capabilities. Monetary fields are decimal strings; authoritative precision, tax and rounding validation belongs to a later orchestrator. FT/FR/RC/NC/ND are proposed contract types, not a statement of legal applicability. Health is not certification.

Run from apps/web: node --test --import tsx tests/unit/fiscal-provider-foundation.spec.ts

## Next gates (not implemented)

1. PostgreSQL connections, immutable operation snapshots, outbox and external document references; composite tenant foreign keys, unique operation and idempotency constraints, service-only mutation, RLS read scope, private credentials. Keep payment and issuance state separate. Verify existing fiscal bindings and historical visibility.
2. Inngest worker claims outbox with bounded leases and retries. Pin connection per operation; after timeout reconcile by stable external reference, never blindly retry or switch providers. If the provider cannot prove non-issuance, require manual resolution. Ensure payment commit and required outbox insertion are atomic; respect legal deadlines and approved contingency.
3. Select partner after API contract, certification scope and legal confirmation. Sandbox homologation for concurrent issuance, duplicate webhooks, signature verification, reconciliation, tax/exemption mapping, official PDF, credits/cancellations, SAF-T, outages and credential rotation. No cross-provider correction without approved procedure.
4. Super-admin controlled rollout per fiscal company, explicitly disabled by default, auditable activation, no automatic native/external failover. Validate portal permissions and historical documents. No school activation before explicit approval and homologation.
