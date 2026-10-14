# Balcão / Command Center — reconciled development base

**Base SHA:** 0d57f73561797001067f87e716852ebb140b3e85
**Source archives:** archive/feature/balcao-workspace-ssot-20261005,
archive/gracefulness/balcao-hardening.
**Do NOT reopen or merge the archived branches.** The legacy workspace
branch precedes main's refinements to student switching, print layouts,
topbar search, session handling, and modal navigation.

This fresh branch retains *all* current main contracts and brings no
old UI files or SQL. It is intentionally safe as an isolated workspace
for new changes. It adds explicit regression tests of the current
URL context handoff: selecting enrollment suspends the desk student;
returning to desk restores that student; selecting no student clears
both identifiers.

## Required before future merge

- Keep the topbar-to-Balcao modal and no-remount navigation of #187/#188.
- Preserve one student per desk encounter and guarded context switching.
- Maintain receipt authorization, search audit, auth refresh and fiscal
  behavior. Never backport full legacy files blindly.
- On every new change run Balcao P0, KF2, Auth Refresh, typecheck, and
  test synthetic flows for the affected feature.
- Compare new PR merge-tree against the *then-current* production
  commit, not just this base, and validate 15-minute Vercel logs after
  approved merge.
- Current main is one commit ahead of the last READY deployment at the
  time of reconciliation; never call this branch production-deployed.
