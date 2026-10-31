# KLASSE: PR #123/#124 payment receipt reconciliation (12 October 2026)

Baseline: main 8e881a69. Both old heads have merge-tree conflicts with main; cherry-equivalence found 0 exact matches among 11 distinct commits in #123 and 8 in #124. The attached pr123-pr124-hunks.csv inventories every hunk against its original PR base, using git apply --check -R and per-file analysis. #123 also contains unrelated ChatGPT integration diffs because of its stale base.

## Isolated work in this DRAFT

The current Balcao handles operational receipts through emitir_recibo/emitir_recibo_servicos and documentos_emitidos. The old PR's paymentId-only print pages are missing from main, but directly porting their code would bypass the canonical emitted-document flow and carries unreviewed tenant/role checks and any casts. They remain RESIDUAL, NOT MERGED. The old finance route removes the fiscal adapter and is CONFLITANTE with current main, so was not ported. No duplicate payment processing logic is introduced.

Only the optional label 'Comprovativo operacional — não fiscal' is ported, default OFF. Synthetic render tests show fiscal/default receipts are unchanged.

## Production READ ONLY, no replay

11 October baseline: 38 failed (13 first attempt, 25 exhausted); external delivery for all remained INCERTO. The independent 12 October read-only snapshot instead shows failed=36 (6 with attempts=1, 5 with attempts=2, 25 with attempts=5), pending=301 and sent=4112. Among the 36 currently failed, 25 have exactly one linked emitted document, 11 have none and zero had matched delivered_at in the examined communication_outbox/notification_messages correlations. Absence of a local delivery record does NOT prove non-delivery. Fourteen events have processed_at following last deployment around 07:03 UTC on 12 October; without the exact historical 38 IDs, do not infer which of them changed or reclassify any INCERTO.

Hobby-plan runtime logs are unavailable for the 24h span; no entries in the latest available 15-minute window. pg_cron DB outbox workers are healthy, but this does not prove the /api/jobs/outbox HTTP route ran. Leave HTTP invocation as NOT_PROVEN.

## Owner-gated SQL

supabase/ops/scripts/replay_receipt_outbox_PROVEN_ONLY.sql is READ-ONLY DRY RUN by default. Writes require explicit execute flag, classification NUNCA_ENTREGUE, external proof reference, exact owner approval phrase, zero existing receipts, no known delivery, and one-time private snapshot in a transaction. Do not run with execute enabled until independently verifying all providers and recipient channels; process at most five proven events, with individual dry runs and duplicate checks. All original INCERTO events are prohibited from replay.

# Source PRs remain OPEN until the residual paymentId-printing security contract and fiscal separation are resolved.
