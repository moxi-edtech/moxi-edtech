# M2 — Full disposable Supabase/Postgres financial integration gate

No migrations, fiscal engines, roles or policies are modified in this PR. The CI workflow \`balcao-finance-integrated.yml\` starts Supabase **locally on the runner only**, checks that all repository migration versions were installed, then runs the original security-definer RPCs and RLS. The test covers a synthetic proof submission, refusal of unauthorized professor, separation of school B and school A, actual approval, ledger balance readback, double-submission idempotency, rejection/resubmission, and concurrent approval/rejection using two real PostgreSQL connections. The real \`emitir_recibo\` RPC is executed transitively by the approval; no fiscal guard is stubbed.

Expected source migration files: **873**. The test must fail closed if full reset, an original migration, RLS or a receipt guard fails; reduced bootstrap is not equivalent and cannot substitute this result.

The existing finance action already requests authoritative readback in the interface before showing settlement, and the CI contract checks this. SQL validates the actual ledger after each mutation and flags discrepancies.

No production connection string or school data are used.
