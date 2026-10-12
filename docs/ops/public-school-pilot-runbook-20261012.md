# KLASSE — Public-school pilot runbook (tenant gated)

Do not activate before separate approval for migration deployment.
Merging application code is NOT permission to apply SQL.

## Activation checklist
- [ ] Identify tenant by internal ID only; no student or payment data in reports
- [ ] Validate an active school_operating_profiles record with its
      finance_model, effective dates, and audit trail
- [ ] Treat school_sector as descriptive, never a legal inference
- [ ] Verify explicitly configured finance_model:
      tuition / budget / emoluments_only / mixed
- [ ] Confirm recurring tuition is only enabled by finance_model tuition,
      with no implicit tuition charges for budget or mixed
- [ ] Validate one school tenant and a different-school tenant isolation
- [ ] Exercise Secretaria, Financeiro, aluno, professor role and tenant guards
- [ ] Check matricula, rematricula, one-time fees, operational receipt print,
      and absence of unauthorized or auto-generated recurring charges
- [ ] Preserve a private-school tuition regression test before rollout
- [ ] Verify receipts and finance events remain immutable and audit tracked

## Migration gate
The branch adds two migrations:
20270826128000_public_school_finance_capability_guards.sql
20270826129000_public_school_rematricula_capabilities.sql
Application deployment does NOT imply supabase db push, migration repair,
or execution against production. Demand separate owner/DBA sign-off,
disposable Postgres contract tests, snapshot and rollback plan.

## Canary, monitoring and rollback
1. Enable pilot only for one authorized internal tenant ID.
2. Validate read-only operations, then one synthetic one-time payment,
   without creating a recurring tuition obligation.
3. Watch Vercel route/error logs and tenant-isolation warnings for 15 min.
4. On regression, stop pilot, issue git revert of the application merge,
   deploy previous SHA, verify READY and 15 minutes of clean runtime logs.
5. DO NOT execute DROP, rewrite fiscal events, or revert production
   migrations without separate DBA-approved data migration plan.
6. Resume only after independent review of the previous failure.

Exit gate: no legal rule inferred from school_sector; explicit finance_model
and no forbidden payment mutation; tenant, roles, UI and receipts verified.
