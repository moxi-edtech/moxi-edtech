# APPLY DIFF — fiscal-recovery-20260930-01

status: PROPOSED
base_main: `1a283020191934148964d6e416ad6e80f2ec1217`
recovery_branch: `recovery/fiscal-agt-preservation-20260930`
canonical_fiscal_source: PR #131 head `6b4c96af247ef57024f41b5db40247d0d4aa7f6a`
staged_patch_sha256: `1f4f5dcc40e4c82029f3aec6045c4087d812582fc93d3a439470e18150385325`

## Exact staged scope

- 177 files
- 31,534 additions
- 770 deletions
- 0 unstaged files
- 0 untracked files
- Secret scan: 0 matches
- 61 migration files in the recovery diff:
  - 60 historical fiscal migrations already recorded as applied in Supabase production.
  - 1 new migration, not applied: `20260930174453_recover_fiscal_hardening_current_contract.sql`.

The exact local staged patch is `/tmp/fiscal-recovery-final.patch`, with the SHA-256 above. The hash was recomputed after the final type/schema reconciliation and before this approval gate.

## Why this recovery exists

PR #136 aligned the accumulated product work with `main`, but did not preserve the complete fiscal/AGT tree that existed cumulatively through PR #131. The current `main` was found to be a subset of the PR #131 fiscal tree.

Recovery analysis found:

- 69 fiscal-tree files present in PR #131 and missing from current `main`.
- A broader fiscal/finance recovery diff of 177 files after restoring dependencies and migration history.
- Several historical migrations are still live in Supabase while their files disappeared from Git.
- Three historical hardening migrations were never applied and are intentionally NOT restored as pending historical migrations:
  - `20260927230500_fiscal_key_custody_least_privilege.sql`
  - `20260927231200_financial_ledger_append_only_hardening.sql`
  - `20260928002000_bill_018_payment_idempotency_hardening.sql`

Their still-needed semantics are adapted to the current contract in the single new recovery migration.

## Recovery strategy

The recovery is not a blind cherry-pick.

1. Base is the exact production `main` commit.
2. PR #131 is used as the cumulative fiscal source because it is descendant of PRs #126, #127, #129 and #130.
3. Newer KF2/Vercel/CI implementations from current `main` are preserved.
4. A three-way patch restored the fiscal/finance tree.
5. Four real conflicts were manually merged instead of taking either side wholesale:
   - `apps/web/src/app/api/aluno/financeiro/comprovativo/route.ts`
   - `apps/web/src/app/api/financeiro/pagamentos/registrar/route.ts`
   - `apps/web/src/app/api/secretaria/balcao/pagamentos/route.ts`
   - `apps/web/src/components/aluno/financeiro-portal/PaymentDrawer.tsx`

### Conflict invariants preserved

- Student proof upload keeps current multi-mensalidade consolidated flow.
- Proof retries gain stable idempotency without regressing consolidated uploads.
- Secretaria balcão keeps current academic billing-window checks.
- Secretaria multi-item atomic checkout remains intact.
- Operational receipts remain the fallback when the AGT engine is disabled.
- Fiscal documents are emitted through the restored canonical fiscal adapter when the AGT engine is enabled.
- Current writers are not replaced by older historical SQL versions.

## New migration

`supabase/migrations/20260930174453_recover_fiscal_hardening_current_contract.sql`

Purpose:

- recover fiscal key-custody least privilege that is absent live;
- recover financial ledger immutability guards absent live;
- adapt BILL-018 stable payment identity to the CURRENT payment/proof contract;
- preserve historical NULL idempotency rows (no backfill);
- keep currently active canonical writers and dependencies;
- support deterministic parent/child identities for consolidated proof uploads;
- avoid revoking legacy functions that are still called by live canonical functions.

This migration has NOT been applied to any remote database.

## Generated database types

`types/supabase.ts` is reconciled with columns already present in the live Supabase schema, including AGT document status/rejection, contingency fields, AGT series provisioning fields, and nullable canonical `p_mensalidade_id`.

## Validation completed

- Fiscal Certification unit suite: **103/103 PASS**
- Fiscal Certification typecheck: **PASS**
- Full web TypeScript check, cache disabled: **PASS**
- KF2 path-filter regression: **PASS**
- UI Standards regression suite: **PASS**
- WhatsApp regression suite: **PASS**
- UI Standards gate: **PASS**
- Security tests: **PASS**
- KF2 Search Audit: **PASS**
- Codex Scan: **0 critical / 0 high / 0 medium; 6 low**
- Performance Gate: **PASS**
- Production-mode Vercel build: **PASS**
  - Next.js 15.5.7
  - 182/182 static pages generated
  - exit code 0
- Secret scan over staged diff: **0 matches**
- `git diff --cached --check`: **PASS**

## Production safety

At this approval point:

- no recovery code has been pushed to `main`;
- no recovery code has been deployed;
- the new recovery migration has NOT been applied remotely;
- existing production remains on merge commit `1a283020191934148964d6e416ad6e80f2ec1217`.

## Apply after approval

After the required approval commit:

1. commit/push the exact staged recovery patch to `recovery/fiscal-agt-preservation-20260930`;
2. open a dedicated recovery PR to `main`;
3. run GitHub CI/Fiscal Certification on the pushed commit;
4. build/deploy Preview only;
5. review the new migration separately before any production DB apply;
6. do not merge/deploy Production until all gates remain green.
