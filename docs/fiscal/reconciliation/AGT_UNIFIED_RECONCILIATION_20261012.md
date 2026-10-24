# AGT reconciliation against original main and Draft #182

**No merges, production writes, AGT requests or series creation.**
All branches are evaluated against main (12 October). Git presence is not proof of applied fiscal migrations.
The complete changed-path/migration mapping is in the CSV.

| PR | Branch | Fiscal paths | Absent main | Different main | Same main | Guard-sensitive | Merge conflict | Unique commits |
|---|---|---:|---:|---:|---:|---:|---|---:|
| #118 | fix/bill-001-005-fiscal-hardening | 15 | 8 | 7 | 0 | 4 | no | 34 |
| #119 | fix/bill-006-agt-electronic-invoicing | 32 | 19 | 13 | 0 | 4 | no | 68 |
| #120 | fix/bill-007-payments-ledger-receipts | 47 | 34 | 13 | 0 | 4 | yes | 113 |
| #121 | fix/bill-008-saft-semantic-accounting | 62 | 43 | 19 | 0 | 4 | yes | 202 |
| #122 | fix/bill-009-tax-engine-vat | 80 | 61 | 19 | 0 | 20 | yes | 282 |
| #125 | fix/bill-010-document-lifecycle | 134 | 105 | 29 | 0 | 22 | yes | 483 |
| #131 | feat/agt-certification-machine | 163 | 134 | 29 | 0 | 23 | yes | 522 |
| #137 | recovery/fiscal-agt-preservation-20260930 | 152 | 135 | 17 | 0 | 22 | yes | 6 |

## Safety and order

The 61 historical remote-only migration versions were recovered inside Draft PR #182, not main.
Those source files must be cross-checked with the remote schema ledger, deduplicated, and fully replayed before any fiscal PR can merge.
Do not cherry-pick old BILL migrations into main or reapply production-applied SQL.
Guard-sensitive paths (BILL-001..003/009, immutable ledger, tax profiles, least privilege, RPC lockdown) remain protected; no guards were modified here.
Code extraction order: (1) pure decimal/discount identity utilities (this PR), (2) AGT adapter & signing sans network calls, (3) durable submission ledger/worker, (4) preflight and certification runner with simulated evidence.
No real HML/production calls, no --execute, no series or KMS access.
PR #137 has 5 passing fiscal negative tests in its original fiscal worktree. They must be made permanent by #182, which remains blocked on Supabase PostgreSQL 17 full replay and production schema-only dump parity.
Before activating even a pure module in production, require an independently green main fiscal CI and proof that the extracted adapter cannot bypass the existing BILL immutable contract.
