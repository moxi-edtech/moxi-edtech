# Balcão > Lançar Nota — auditoria e correção (13/10/2026)

Branch: work/balcao-workspace-20261013, PR #191. No migration, grants,
RLS, fiscal guard, student data or production write introduced.

## Causa

The quick grade modal PautaRapidaModal resolved the server's academic
session ID for the **writer and grade grid**, but populated its turma
select with the local device's calendar year (new Date().getFullYear)
against the admission-specific materialized view
vw_turmas_para_matricula. The view limits rows to an admission
eligibility context and currently active year. It is not the canonical
grade-class list. The selector silently reported an empty list or
hid failures, despite the rest of the flow expecting a verified session.

Read-only production catalogue check (counts only, no identifiers):
there are 48 classes / 398 discipline assignments in active 2025
sessions and 47 classes / 799 discipline assignments in active 2026
sessions. Therefore a clock-bound 2026 selector is invalid for active
2025 schools. Production runtime logs did not contain an identifiable
request failure in the accessible window; root cause is confirmed from
static data flow plus schema constraints, not from a captured
authenticated browser error.

A second entrypoint, /secretaria/notas, read ano_letivo_id only from
the URL. Without that parameter it did not resolve an active session
and rendered an empty class list. Both surfaces are now aligned.

## Implemented

- New GET /api/secretaria/notas/turmas, authenticated and scoped to
  school membership, grade-operator RBAC and an actual academic
  session. Reads canonical turmas, not the admission materialized view.
- Paginates in stable school-local name/id order; client retrieves
  all pages (no first-50 truncation).
- Both modal and standalone notes page resolve the active session,
  or honor an explicitly selected historical session as read-only.
- The modal visibly reports class, discipline and grade-load errors;
  retries are available for the class selector. Invalid grades stay
  blocked by the canonical teacher/secretaria writer and grade range.
- Saves notes in at most 50 students per independent idempotency
  request, stops at the first failure and displays the error.
- The post-matricula Balcão action EnrollmentPostActionModal was
  calling the canonical POST without mandatory ano_letivo_id; this
  deterministically fails with ACADEMIC_YEAR_REQUIRED. The action now
  resolves the active school session and includes it in the body,
  verifies the student's class subject and scale with the pauta-grid
  endpoint before enabling the button, and resets confirmation when
  the operator switches subject or period.
- No permission widening, no fiscal, billing or enrollment changes.

## Gates

Node synthetic tests: school/year scope, class pagination beyond 50,
cross-year API rejection, 107 grades in batches of 50/50/7,
idempotency, fail-closed on API/RPC errors.
PostgreSQL 17 synthetic regression: authorized secretaria and assigned
teacher can insert/update; unassigned/cross-tenant actor rejected;
out-of-scale, inactive enrollment and closed academic year rejected.
Typecheck and focused ESLint are mandatory in the PR CI.

## Production validation

This branch does not perform test payments or change real student
grades in production. Before an approved production merge, validate
the operation with a permitted school's dedicated synthetic/test
student, selecting a turma, disciplina, trimestre, editing grade,
reopening the grid and confirming the persisted grade; validate
unauthorized role, missing assignment, and active vs historical year.
After deploy confirm READY and observe 15 minutes without new
runtime errors. Treat a green CI as necessary but not a substitute
for that authenticated end-to-end verification.
