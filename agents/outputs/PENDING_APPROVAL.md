# PENDING APPROVAL — fiscal-recovery-20260930-01

status: PENDING_APPROVAL
branch: `recovery/fiscal-agt-preservation-20260930`
base_main: `1a283020191934148964d6e416ad6e80f2ec1217`
proposed_patch_sha256: `1f4f5dcc40e4c82029f3aec6045c4087d812582fc93d3a439470e18150385325`

## Approval requested

This recovery restores the fiscal/AGT work that was lost during the main-alignment merge while preserving the newer finance, Secretaria, KF2 and Vercel behavior already present in current `main`.

The proposed functional diff is documented in:

`agents/outputs/APPLY_DIFF_fiscal-recovery-20260930-01.md`

## Scope after approval

The approval authorizes ONLY:

- commit/push of the already validated recovery diff to this recovery branch;
- creation/update of a recovery PR to `main`;
- CI, typecheck, tests, build and Preview validation.

It does NOT authorize:

- applying `20260930174453_recover_fiscal_hardening_current_contract.sql` to Supabase production;
- merging the recovery PR to `main`;
- Production deployment.

Those remain separate gates.

## Risk controls

- 60 restored historical migrations are already recorded in Supabase production and therefore restore Git history rather than schedule new DDL.
- The one new migration is isolated under version `20260930174453`.
- No production mutation has been performed.
- Four cross-era conflicts were manually reconciled instead of blindly choosing PR #131 or current `main`.
- Full TypeScript, fiscal tests, KF2/security/UI/performance and Production-mode build are green.

## Required approval

Create/record a commit with exactly:

`APPROVE: fiscal-recovery-20260930-01`
