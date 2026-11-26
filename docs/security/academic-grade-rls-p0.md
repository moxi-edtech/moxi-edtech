# P0 — Academic grade data boundary

Production read-only audit 2026-11-26 confirmed: unpaid own raw grades, unpaid own summary, and another pupil's summary visible under an authenticated pupil session.

This migration closes those paths and the named assessment, exam, dependency and official-pauta Storage paths. It deliberately uses an owner-executed security-barrier view with an explicit row predicate because the underlying materialized view does not support RLS. The raw MV grant is removed. A generic security-definer-view advisor warning is expected; do not silence it without reviewing the authorization predicate.

No fiscal engine or payment writes changed. No production migration executed.

## Release gate
- Disposable PostgreSQL tests: pupil A unpaid/paid, sibling guardian, pupil B same school, foreign school, assigned/unassigned teacher, staff, anonymous; direct tables/view/RPC and Storage.
- Confirm paid access for the exact enrollment; legacy paid declarations must retain access, pending/granted-without-settlement must not.
- Verify rematricula/RAA progression and historic grade workflows before deploy; do not tie operational enrollment eligibility to purchasing a bulletin.
- Review remaining SECURITY DEFINER RPCs and existing signed class PDF URLs; storage changes do not revoke already-issued signed URLs.
- Re-run the original read-only audit and EXPLAIN the scoped view in staging. Never use real pupil data in CI.

## Follow-up: progression and financial SSOT

Private copies of the existing legal engine are owner-only. Public individual grade RPCs require paid ownership or assigned staff/teacher scope; progression RPCs authorize the exact enrollment and return an allowlisted decision projection for unpaid students. The portal calls the SQL payment predicate through aluno_boletim_pago. The read model uses per-query authorization sets and two partial financial indexes. The disposable fixture exercises the call graph and a 6k-row synthetic benchmark; it is not a production-sized full-schema legal-engine replay. Verify the historical paths, actual legal formulas, publication state, remaining privileged functions and signed URLs before production. Apply database migration before publishing application code.
