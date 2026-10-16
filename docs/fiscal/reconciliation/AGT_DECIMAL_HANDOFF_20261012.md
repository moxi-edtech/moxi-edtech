# AGT exact decimal — standalone compatibility extraction

Draft PR from main. The pure fiscal decimal module was recovered from
PR #137; it has no network access, no KMS, no Supabase, and cannot submit
or issue fiscal documents. Six synthetic regression tests cover decimal
addition without IEEE-754 drift, unit prices at four places, settlement,
half-up rounding, equality, and transport-only JSON conversion.

No migrations, RLS, grants or immutable fiscal guards were modified.
The existing BILL negative suite remains validated independently on the
recovery PR #137. It cannot be wired permanently into standalone main
until PR #182's migration provenance passes the full replay gate.
After #182 is approved, the dedicated CI must be extended to run the
exact five negative fiscal tests. This is a non-deployable library
reconciliation and must remain Draft until main's fiscal verification.
