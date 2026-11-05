# AGT / BILL — consolidated *safe source branch* for subsequent development

**Base SHA:** 0d57f73561797001067f87e716852ebb140b3e85.
Sources: PR #137 (fiscal recovery), PR #131 (certification machine),
the #118–#125 BILL chain, and new Draft PRs #185/#186.

The original AGT branch is stacked on historical BILL-010/009/008/007/006
migrations and should NOT be merged or rebased wholesale onto main.
The separate #185/#186 already isolate two pure, tested components.
This consolidated development branch brings ONLY:
- exact decimal arithmetic (no database or network);
- certification P01–P17 plan and P09 Luanda clock check (no execute).

No old fiscal SQL, SECURITY DEFINER function, RLS, role/grant,
certificate, secrets, remote AGT connector or destructive operation
was copied. No overlap with any application revenue calculation was
introduced. The existing #185/#186 remain independent Draft evidence;
avoid merging both and this consolidated PR together without deduping.

Next units, each in its own PR: AGT adapter/signing (test double),
submission ledger and retry/outbox, and preflight certification runner
with mocked transport. Every future PR must be rebased/merged from main,
tested against the eventual DB schema, and checked by the BILL
immutability negative suite. PR #182's full migration replay/schema
parity is a blocker before any AGT production merge.

This branch is a development workspace, NOT currently safe to deploy
or authorize fiscal migration. Preserve archived refs; no production
writes have occurred.
