# KLASSE — Apply Result
run_id: 27FAC9C2-0DB0-42EF-A481-171FD0EB8522
status: PASS
timestamp: 2026-08-01T20:05:30Z

## Alteração aplicada

Executada na base indicada a migration
`supabase/migrations/20270730230000_create_operacoes_dashboard_work_mv.sql`.

## Evidências pós-deploy

- Transaction `COMMIT`: PASS.
- MV: 7 linhas e 7 escolas únicas.
- UNIQUE INDEX: presente.
- Índice `pautas_lote_jobs(escola_id, status)`: presente.
- Refresh contém `CONCURRENTLY`: PASS.
- Cron job `207`: ativo, a cada cinco minutos.
- `authenticated` sem SELECT na MV interna: PASS.
- `authenticated` com SELECT no wrapper: PASS.
- `authenticated` sem EXECUTE no refresh: PASS.
- `service_role` com SELECT interno e EXECUTE no refresh: PASS.
- Wrapper sob JWT operacional: 1 escola visível para 1 membership.

## Dados materializados

- Turmas sem horário publicado: 80.
- Documentos pendentes/falhados: 2.
- Mensagens falhadas: 0.

## Meta p95

Dashboard operacional inferior a 200 ms; agregações fora do request.
