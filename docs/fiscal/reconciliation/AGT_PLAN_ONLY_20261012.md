# AGT preflight certification plan, isolated and no network effects

This Draft independently extracts only the pure P01-P17 certification
scenario metadata, local-vs-FE series categorization, and eligibility
check for P09 in the Africa/Luanda clock. No AGT API request is made,
no series is provisioned and no --execute is available in this patch.
The four synthetic tests cover uniqueness of P01-P17, classifications,
P13 N/A safety and a strict P09 time-window gate.
The original fiscal branch #131/#137 and all BILL PRs remain unmerged;
no migrations, fiscal guards, permissions or RLS are changed.
Readiness requires the owner's actual certificate, series, credentials
and independently approved full schema parity from #182.
