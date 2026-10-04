# APPLY DIFF — fiscal-recovery-migration-20260930-02

status: PROPOSED
branch: `recovery/fiscal-agt-preservation-20260930`
base_functional_head: `b50e0ff7e0f497d3a6bc5949409fa4d50f467f21`
delta_sha256: `30fa684e6bc9caa9c0bd6d553e7860658e8d573d1c61ed4d3bcb15c17e3f3028`

## Why this micro-recovery exists

A post-push migration audit found two issues in the new, still-unapplied recovery migration before they reached Supabase production.

### 1. Proof resubmission evidence could be deleted

The singular proof RPC reused an existing pending payment, updated `evidence_url`, but returned `idempotent=true`.

The API intentionally deletes a freshly uploaded object when the RPC reports a true replay. Therefore a genuine resubmission with a new idempotency key could update the database to the new proof URL and then delete that same proof object.

Proposed fix:

- preserve the immutable payment `idempotency_key`;
- record the latest resubmission identity separately as `meta.last_resubmission_idempotency_key`;
- first application of a new resubmission returns `idempotent=false, resubmitted=true`, so the uploaded proof is retained;
- retry of that same resubmission returns `idempotent=true, resubmitted=true` without replacing evidence again;
- merge `p_meta` without overwriting the canonical payment `idempotency_key`.

### 2. Legacy-caller preflight could inspect PostgreSQL aggregates

The preflight used `pg_get_functiondef(p.oid)` over `pg_proc` without constraining `prokind`.

A PostgreSQL 17 isolated execution reproduced a hard migration failure:

`"array_agg" is an aggregate function`

Proposed fix:

- restrict this caller audit to normal functions with `p.prokind = 'f'`.

## Additional fail-closed preflight added

Before revoking direct table access or replacing payment guards, verify:

- `fiscal_register_key_ref(...)` exists;
- it remains `SECURITY DEFINER`;
- its owner matches the owner of `public.fiscal_chaves`;
- `service_role` retains EXECUTE on it;
- the existing payment INSERT guard trigger is active and points to `financeiro_guard_pagamento_insert`;
- the existing payment UPDATE guard trigger is active and points to `financeiro_guard_pagamento_update`.

Live read-only audit already confirmed all of these invariants in production.

## Exact delta

Only two functional files change relative to `b50e0ff7...`:

- `supabase/migrations/20260930174453_recover_fiscal_hardening_current_contract.sql`: +82 / -2
- `apps/web/tests/unit/payment-idempotency-migration.spec.ts`: +25 / -0

Total: +107 / -2.

No application TypeScript/React route changes are part of this micro-diff.

## Validation

- exact delta SHA-256: `30fa684e6bc9caa9c0bd6d553e7860658e8d573d1c61ed4d3bcb15c17e3f3028`
- `git diff --check`: PASS
- targeted migration/idempotency tests: 10/10 PASS
- full Fiscal Certification suite after resubmission fix: 104/104 PASS
- Fiscal Certification typecheck: PASS
- PostgreSQL 17 isolated harness: migration compiles and commits with `ON_ERROR_STOP`
- isolated runtime proof:
  - initial proof -> idempotent=false
  - same retry -> idempotent=true; evidence remains original
  - new resubmission -> idempotent=false; replacement evidence retained
  - same resubmission retry -> idempotent=true; replacement evidence remains
- key custody proof:
  - anon SELECT fiscal_chaves = false
  - authenticated SELECT fiscal_chaves = false
  - service_role SELECT = true
  - service_role INSERT = false
  - service_role EXECUTE fiscal_register_key_ref = true
- payment hardening proof:
  - authenticated legacy registrar_pagamento EXECUTE = false
  - payment insert guard active = true
  - five immutable TRUNCATE guards installed
- app code audit:
  - no direct fiscal_chaves mutations
  - no app RPC calls to legacy `registrar_pagamento` / `realizar_pagamento_balcao`
  - all three direct `pagamentos` inserts already provide stable `idempotency_key`
- DB caller audit:
  - only `fn_sync_financeiro_ledger()` calls `fn_ledger_insert_once`; it is SECURITY DEFINER owned by postgres.

## Production safety

This delta has NOT been pushed.

The migration `20260930174453_recover_fiscal_hardening_current_contract.sql` remains NOT applied to Supabase production.

Approval of this run authorizes only:

1. commit/push of these two files to the recovery branch;
2. CI/Fiscal Certification rerun;
3. PR/Preview validation.

It does NOT authorize:

- Supabase production migration apply;
- merge of PR #137;
- Production deployment.
