# REPORT_PILOT_READINESS.md — Pilot Readiness Scan

[P0.1] Tenant Isolation — FAIL
Evidence: `mensalidades` com `escola_id` nullable (`information_schema.columns` retornou `YES`).

[P0.2] RLS REAL POR ROLE — FAIL
Evidence: apenas policies listadas em `pg_policies`; nenhum teste HTTP 200/403 executado para `secretaria`, `professor`, `aluno`, `admin`.

[P0.3] Service Role fora do fluxo humano — FAIL
Evidence: uso de `SUPABASE_SERVICE_ROLE_KEY` em rotas humanas (`apps/web/src/app/api/escolas/[id]/cursos/route.ts`, `apps/web/src/app/api/escolas/[id]/turmas/route.ts`, `apps/web/src/app/api/escolas/[id]/alunos/novo/route.ts`).

[P1.1] Candidatura → Matrícula — FAIL
Evidence: nenhum teste SQL/HTTP executado com `CANDIDATURA_ID` real.

[P1.2] Matrícula & Rematrícula — WARN
Evidence: sem duplicidade de matrículas ativas (`select aluno_id, ano_letivo, count(*) ...` retornou 0 linhas); idempotência de rematrícula e status transferido não validados.

[P1.3] Pagamentos E2E — FAIL
Evidence: `pagamentos` vazio, `outbox_events` vazio, `audit_logs` sem ação registrada para `FINANCE_PAYMENT_CONFIRMED`.

[P2.1] Presenças / Frequências — WARN
Evidence: índices únicos existem (`ux_frequencias_*_escola_matricula_data_aula`), mas SSOT (presencas vs frequencias) e dedupe por dupla inserção não testados.

[P2.2] Notas & Boletim — WARN
Evidence: `notas` e `avaliacoes` sem dados; não há view/RPC de consolidação (nenhuma view com `boletim/nota/media`).

[P3.1] Transferência de Turma — FAIL
Evidence: apenas rota `check-transfer` (`apps/web/src/app/api/secretaria/matriculas/[matriculaId]/check-transfer/route.ts`), sem endpoint explícito de transferência + auditoria.

[P3.2] Importação (Backfill) — WARN
Evidence: rotas de migração existem (`apps/web/src/app/api/migracao/[importId]/configure/route.ts`), mas idempotência e aprovação não verificadas.

[OUTBOX] Eventos mínimos — FAIL
Evidence: `select event_type, count(*) from outbox_events` retornou 0 linhas para `AUTH_PROVISION_USER` e `FINANCE_PAYMENT_CONFIRMED`.

PILOT READINESS: NO-GO
BLOCKERS: P0.1, P0.2, P0.3, P1.1, P1.3, P3.1, OUTBOX
WARNINGS: P1.2, P2.1, P2.2, P3.2

## Atualizações recentes (não revalidadas)
- RLS `anos_letivos` e `periodos_letivos` (SELECT) aplicado.
- RLS `curso_matriz` e `turma_disciplinas` (SELECT/INSERT/UPDATE) aplicado.
- Índices UNIQUE para `curso_matriz` (upsert) aplicados.
- Fluxo `install-preset` ajustado para devolver erros reais.
- Cockpit financeiro atualizado + MVs operacionais criadas.

**Nota:** este relatório precisa de nova rodada de evidências para atualizar status acima.
