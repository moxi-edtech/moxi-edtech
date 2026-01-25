# Pilot Readiness Report — Admin Academic Setup

## P0 — MULTI-TENANT + INTEGRIDADE
- [P0.1] escola_id NOT NULL em tabelas core — PASS
Evidence: SQL remoto (informação schema) confirmou `is_nullable = NO` para 14 tabelas (anos_letivos, periodos_letivos, cursos, classes, turmas, matriculas, turma_disciplinas, curso_curriculos, curriculo_itens, avaliacoes, notas, frequencias, financeiro_titulos, financeiro_cobrancas, pagamentos).

- [P0.2] Índices começando por escola_id (tabelas grandes) — WARN
Reason: `financeiro_titulos` não apareceu no filtro `(escola_id, ...)`.
Evidence: SQL remoto em `pg_indexes` retornou índices com `escola_id` para alunos, avaliacoes, frequencias, matriculas, notas, pagamentos e turmas.

- [P0.3] RLS real por role (secretaria/professor/aluno/admin_escola) — FAIL
Reason: policies listadas apenas para `{authenticated}` (sem segmentação por role).
Evidence: SQL remoto em `pg_policies` para `alunos`, `matriculas`, `turmas`, `notas`, `avaliacoes`, `frequencias`, `pagamentos`.

- [P0.4] Service Role fora de endpoints humanos — FAIL
Reason: uso de `SUPABASE_SERVICE_ROLE_KEY` em rotas humanas fora de jobs/workers/provisioning/cron.
Evidence: `apps/web/src/app/api/escolas/[id]/classes/route.ts`, `apps/web/src/app/api/escolas/[id]/disciplinas/route.ts`, `apps/web/src/app/api/escolas/[id]/turmas/route.ts`, `apps/web/src/app/api/escolas/[id]/alunos/invite/route.ts`, `apps/web/src/app/api/escolas/[id]/admin/alunos/[alunoId]/route.ts` e outras no `agents/ACADEMIC_REPORT_SCAN.md`.

Related reports: `agents/outputs/REPORT_INDEX.md`.

## P1 — CORE DO PORTAL CONFIG (Admin Setup)
- [P1.1] Ano letivo + períodos (TRIMESTRE 1/2/3) — PASS
Evidence: SQL remoto com `escola_id=f406f5a7-a077-431c-b118-297224925726` retornou 3 linhas TRIMESTRE para `ano=2026` (colunas `data_inicio/data_fim` + `trava_notas_em`).

- [P1.2] Currículo versionado por ano (draft/published) — PASS
Evidence: SQL remoto em `curso_curriculos` para `escola_id=f406f5a7-a077-431c-b118-297224925726`, `ano_letivo_id=1952fd7b-4094-487c-8ff6-9a700edfad48` retornou versões publicadas (v1) para 2 cursos.

- [P1.3] Aplicar preset → cria versão draft + itens — FAIL
Reason: evidência HTTP do endpoint não executada.
Evidence: pendente.

- [P1.4] Publicar Currículo (published único) — PASS
Evidence: SQL remoto `group by` mostrou 0 linhas com published duplicado para o mesmo curso/ano.

- [P1.5] Turmas + turma_disciplinas por currículo published — PASS
Evidence: SQL remoto encontrou `turma_id=ea75bf2c-ff64-4ad8-8030-411ed8f5c6cb` com 11 disciplinas em `turma_disciplinas`.

- [P1.6] Setup status view/RPC sem join bugado — PASS
Evidence: SQL remoto em `vw_escola_setup_status` retornou `percentage=100` para `escola_id=f406f5a7-a077-431c-b118-297224925726`.

## P2 — OPERAÇÃO DIÁRIA (Professor/Aluno)
- [P2.1] Frequência SSOT = frequencias — WARN
Reason: evidência HTTP de upsert não executada.
Evidence: SQL remoto confirmou UNIQUE/índices em `frequencias` (`uq_frequencias_escola_matricula_data`).

- [P2.2] Avaliações + Notas trimestrais on-demand — FAIL
Reason: nenhuma evidência HTTP; tabelas sem registros recentes.
Evidence: SQL remoto `avaliacoes` e `notas` retornaram 0 linhas.

- [P2.3] Boletim mínimo com missing flags — FAIL
Reason: `vw_boletim_por_matricula` não possui coluna `trimestre` (requisito por trimestre).
Evidence: `\d public.vw_boletim_por_matricula` e query com `matricula_id=1948bb63-e201-4769-ba1f-2616e08d781c` retornou linhas sem `trimestre`.

## Status Final
- PILOT READINESS: NO-GO
- BLOCKERS: P0.3, P0.4, P1.3, P2.2, P2.3
- WARNINGS: P0.2, P2.1

## Decisões de migração
- `20260123180216_drop_curriculum_tables.sql` removida e NÃO aplicada (destrutiva, removeria `curso_curriculos` e quebraria FKs/fluxo P1).
