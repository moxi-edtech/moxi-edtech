# KLASSE IA — reconciled development branch

**Base SHA:** 0d57f73561797001067f87e716852ebb140b3e85
**Source:** archived release/klasse-chatgpt-v0.2.0, originally PR #133 (closed).
The source archive's integration endpoint, schemas, tools and unit
contract tests are already byte-identical to the main tree. They must
NOT be copied back from the old branch or cherry-picked again.

Current scope is the KLASSE ChatGPT integration (not the DATA-INT /
Impact institutional intelligence project): tool contracts, school-role
isolation, controlled actions, and knowledge retrieval. Work can now
continue safely on this fresh main-derived branch.

## Regression invariants

- JWT authentication, active-school derivation from verified membership,
  and requireRoleInSchool before running a tool.
- No escola_id / school_id accepted from AI-generated input.
- Two-step payment: prepare then explicit confirm; no autonomous charge.
- Strict role-scoped SECURITY INVOKER RPCs, never public EXECUTE.
- Do not include tenant identities, secrets or real student data in tests.
- Keep search, Balcao, financial and academic changes in their own PRs.
- The production RLS/migration state still requires separate
  reconciliation; this branch does not imply production-readiness.
- At every future change run both KLASSE AI contract tests,
  typecheck, and the security boundary tests before approval.

Archived source is retained only for provenance; its old migrations
have not been re-applied, no permission has changed, and production
was not modified during this reconciliation.
