# BILL-001 — evidence 2026-11-24

Status: LIVE CATALOG PASS (direct table mutation); isolated PostgreSQL 17 regression added, CI pending. Not full DB replay, not AGT homologation. No data, migration, grant, feature flag or fiscal document changed in production.

## Provenance
Manifest: [59 versions](evidence/migration-provenance-20261124.json). 37 exact Git blob hashes, 15 boundary-normalized matches, six equal token sequences (heuristic, require parser/object review), one freeze with same executable token sequence and distinct version/comment text. PR #182 contains source-complete 20260927211445, unlike placeholder in #137. Never import all historical migrations or write migration ledger from this evidence. Full object/ACL equivalence and replay remain gates #308/#440.

## Actual database checks
- 12/12 effective table-level denials: anon/authenticated/service_role x INSERT/UPDATE/DELETE/TRUNCATE. Six column-level INSERT/UPDATE checks also denied.
- RLS enabled; none of three roles owns or inherits ownership. service_role bypasses RLS, so ACL is essential.
- Eight enabled non-internal triggers on fiscal_documentos; delete, update and pending insert guards confirmed. Six outbound FKs use DELETE RESTRICT.
- Historical guard bodies match live exactly: fiscal_block_document_delete (md5 eb50ed3256fdbf0463f0ae7a94dc6e70) and fiscal_prevent_update_emitido (45fd67275fed155bfb06a9360958bff1). Pending insert guard live md5 c463a7354384711b4d083ff82816d946; historical exact source not located in selected two files.
- Both school bindings disabled; all four original freeze RPCs denied to all three exposed roles.
- Additional SECURITY DEFINER writers still executable: fiscal_anular_documento and fiscal_rectificar_documento (authenticated/service_role), fiscal_preparar_assinatura_saft and fiscal_finalizar_hash_saft (service_role). Status-only corrections / pending signature changes are distinct from arbitrary mutation but should be frozen or explicitly justified before certification. Audit consumers, prepare separate exact-signature revoke migration and negative tests; no automatic grant restoration or production application in this PR.
- Function search uses SQL text heuristic, not proof of absence of indirect/dynamic writers.

## Reproducibility
supabase/ops/tests/bill001-live-catalog.sql: read-only fail-closed catalog assertions, no RPC invocation. supabase/ops/tests/bill001-immutability-fixture.sql: isolated PG17 fixture, uses two verified historical function bodies, synthetic records and role ACLs; tests signed/pending/closed status, future-column guard, SAF-T prerequisite and four forbidden DML operations for three roles. No real signatures, no network, no production secrets. Does not reproduce all live triggers, tenant/RLS policy, lifecycle RPCs or dependencies; does not prove actual full schema mutation behavior. CI job Fiscal BILL-001 isolated PostgreSQL 17 must pass; full replay/negative suite remains separate.

## Remaining acceptance
Complete six token-only source comparisons with a PostgreSQL-aware parser/statement and final object definitions, resolve freeze version lineage without replay, run complete migration replay and actual schema negative tests, reconcile indirect writers and approve the freeze. Keep #440 and #308 open; do not activate any school before AGT acceptance and distinct authorization.
