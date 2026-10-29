# SSOT — applied lifecycle evidence corrections on 2026-10-29

These SQL files reproduce the exact installed Supabase migration statements (versions 20261029090749, 20261029091406, 20261029091637), as returned from `supabase_migrations.schema_migrations`. They are retained for audit and **must not be rewritten**.

Fresh schema replay uses version-preserving no-op shims at `supabase/migrations/20261029090749_...` etc., then rebuilds the functions and the history lock trigger after all pre-existing 2027 migrations, in `supabase/migrations/20271029100000_lifecycle_reconciliation_evidence_guards.sql`.

## Safety and evidence

- GradeEngine never treats an empty official bulletin as approval.
- Historical academic decisions require a valid source (RAA or signed school declaration in an assisted-transition cohort) and are recorded with a linked, still-open history.
- A legal snapshot lock is refused without an existing matching enrollment, history, documented decision and nonempty lock reason. The legacy snapshot writer's missing `historico_ano_id` is filled from the verified history.
- Imported school lists with a null audit actor remain **not ratified**. `ratificar_resultado_historico_escola` requires an authenticated school administrator, documentary reference, explicit confirmation of the registered result and an audited reason. It does **not** close the legal snapshot.
- The current 550 pending Curtume enrollments are intentionally **not** promoted or closed by these migrations; their academic grades and signed decisions are not available.

The SQL was regression tested in rolled-back transactions before being applied to the live KLASSE backend. No automatic legal closing or historical result import was performed.
