# PENDING APPROVAL — fiscal-recovery-migration-20260930-02

status: PENDING_APPROVAL
branch: `recovery/fiscal-agt-preservation-20260930`
base_functional_head: `b50e0ff7e0f497d3a6bc5949409fa4d50f467f21`
proposed_delta_sha256: `30fa684e6bc9caa9c0bd6d553e7860658e8d573d1c61ed4d3bcb15c17e3f3028`

## Approval requested

Post-push migration review found two pre-production issues in the still-unapplied recovery migration:

1. a genuine proof resubmission could update `evidence_url` and then be misclassified as an idempotent replay, causing the API to delete the replacement proof;
2. the migration preflight could call `pg_get_functiondef` on an aggregate and abort before applying.

The exact proposed correction is documented in:

`agents/outputs/APPLY_DIFF_fiscal-recovery-migration-20260930-02.md`

## Scope

Approval authorizes ONLY:

- commit/push of the two-file micro-diff with SHA-256 above;
- CI/Fiscal Certification rerun;
- PR #137 and Preview validation.

It does NOT authorize:

- applying `20260930174453_recover_fiscal_hardening_current_contract.sql` to Supabase production;
- merging PR #137;
- Production deployment.

## Validation already completed

- targeted migration tests: 10/10 PASS;
- full fiscal suite: 104/104 PASS;
- fiscal typecheck: PASS;
- full migration executed successfully in isolated PostgreSQL 17 with `ON_ERROR_STOP`;
- resubmission/retry semantics proven in the database harness;
- key custody, legacy RPC revocation, payment guards and five TRUNCATE guards proven in the harness;
- live read-only audit confirms the required preflight invariants exist in Supabase production.

## Required approval

`APPROVE: fiscal-recovery-migration-20260930-02`
