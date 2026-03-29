# Apply Diff — Fiscal API Contract
run_id: 2026-03-19-FISCAL-API-CONTRACT
created_at: 2026-03-19T00:00:00Z

## Planned changes
- add Zod schema for POST /api/fiscal/documentos request
- add guarded route handler for fiscal document emission preflight
- add semantic lookup index for active fiscal series
- add API documentation for fiscal documents endpoint

## Safety notes
- no destructive SQL
- no data mutation migration
- no RLS policy changes
- route intentionally blocks fiscal emission until atomic issuer exists
