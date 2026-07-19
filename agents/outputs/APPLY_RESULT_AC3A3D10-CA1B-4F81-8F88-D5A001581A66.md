# Resultado — Agent 3
run_id: AC3A3D10-CA1B-4F81-8F88-D5A001581A66
timestamp: 2026-07-19T01:12:00Z
status: PASS

## Aplicado
`supabase/migrations/20270718170000_revoke_anon_sensitive_operational_reads.sql`

## Verificação

- 27/27 RPCs de leitura operacional sensível sem privilégio efectivo de `anon`.
- 27/27 mantêm `authenticated`.
- 27/27 mantêm `service_role`.
- Consultas públicas de landing, tracking e documentos ficaram fora do lote.
- Nenhuma reversão necessária.
