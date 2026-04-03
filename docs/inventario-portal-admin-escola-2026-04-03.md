# Inventario Tecnico e Funcional - Portal Admin da Escola

Data da varredura: 2026-04-03
Repositorio: /Users/gundja/moxi-edtech
Escopo principal lido: apps/web/src/app/escola/[id]/(portal)/admin, apps/web/src/app/api/escola/[id]/admin, apps/web/src/app/api/escolas/[id]/admin, apps/web/src/components/layout/escola-admin, apps/web/src/lib/sidebarNav.ts

## 1) Metodo usado para o inventario

- Leitura estrutural do portal por rotas, layouts e sidebar.
- Leitura de handlers API do namespace admin e dependencias diretas consumidas pelas telas admin.
- Extracao de tabelas/views/RPCs usados pelo admin.
- Medicao de volume (arquivos e linhas) para priorizacao de POP.

## 2) Panorama do portal admin no codigo atual

### 2.1 Navegacao oficial (sidebar)
Fonte: `apps/web/src/lib/sidebarNav.ts`

Itens do modulo `admin`:
- Dashboard
- Alunos
- Professores
- Operacoes Academicas
- Turmas (lista + pendentes)
- Avisos
- Horarios
- Relatorios
- Documentos Oficiais
- Configuracoes (visao geral, assinatura, financeiro, calendario, seguranca, identidade)

### 2.2 Quantitativo de superficies

- Paginas no portal escola (`/escola/[id]/(portal)`): 97
- Paginas no modulo admin: 30
- APIs totais do app: 368
- APIs no namespace `escolas`: 86
- APIs no namespace `escola`: 24
- APIs no namespace `admin` global: 2
- APIs especificas do admin de escola (somando `/api/escola/[id]/admin` + `/api/escolas/[id]/admin`): 39

### 2.3 Volume de codigo (hotspots)

Top UI admin por tamanho:
- `admin/alunos/page.tsx`: 1438 linhas
- `admin/configuracoes/turmas/page.tsx`: 1244 linhas
- `admin/relatorios/page.tsx`: 750 linhas
- `admin/notas/page.tsx`: 454 linhas
- `admin/configuracoes/avaliacao/page.tsx`: 438 linhas

Top APIs admin por tamanho:
- `admin/curriculo/publish/route.ts`: 416 linhas
- `admin/curriculo/install-preset/route.ts`: 409 linhas
- `admin/configuracoes/avaliacao-frequencia/route.ts`: 290 linhas
- `admin/frequencias/fechar-periodo/route.ts`: 289 linhas
- `admin/configuracoes/financeiro/route.ts`: 233 linhas

Conclusao de complexidade:
- O POP deve começar por fluxos de alta criticidade operacional e alto acoplamento (alunos, turmas/curriculo, setup academico, fechamento).

## 3) Inventario funcional por dominio (admin)

## 3.1 Dashboard admin

UI principal:
- `apps/web/src/app/escola/[id]/(portal)/admin/page.tsx`
- `apps/web/src/app/escola/[id]/(portal)/admin/dashboard/page.tsx`
- `apps/web/src/components/layout/escola-admin/*`

APIs usadas:
- `/api/escolas/[id]/admin/dashboard`
- `/api/escolas/[id]/admin/financeiro/inadimplencia-top`
- `/api/escolas/[id]/admin/financeiro/pagamentos-recentes`
- `/api/escolas/[id]/admin/dashboard/pending-turmas-count`
- `/api/escola/[id]/admin/activity-feed`

Views lidas:
- `vw_admin_dashboard_counts`
- `vw_admin_pending_turmas_count`
- `vw_pagamentos_status`
- `vw_admin_matriculas_por_mes`
- `vw_financeiro_inadimplencia_top`
- `vw_financeiro_missing_pricing_count`
- `vw_financeiro_kpis_mes`
- `vw_admin_activity_feed_enriched`
- `vw_escola_setup_status`
- `vw_escola_estrutura_counts`

## 3.2 Alunos (gestao administrativa)

UI principal:
- `apps/web/src/app/escola/[id]/(portal)/admin/alunos/page.tsx`
- `apps/web/src/app/escola/[id]/(portal)/admin/alunos/[alunoId]/page.tsx`

APIs usadas:
- `/api/escolas/[id]/admin/alunos`
- `/api/escolas/[id]/admin/alunos/[alunoId]` (PATCH/DELETE)
- `/api/escolas/[id]/admin/alunos/[alunoId]/archive`
- `/api/escolas/[id]/admin/alunos/[alunoId]/restore`
- Dependencias cruzadas: `/api/secretaria/alunos/...` e `/api/escolas/[id]/usuarios/invite`

Observacao funcional:
- A tela admin de alunos reutiliza endpoints da secretaria para algumas operacoes (delete/restore/hard-delete/pagamento rapido). O POP precisa explicitar esse comportamento para evitar confusao de permissao e ownership entre areas.

## 3.3 Turmas e curriculo (configuracao academica)

UI principal:
- `apps/web/src/app/escola/[id]/(portal)/admin/turmas/page.tsx`
- `apps/web/src/app/escola/[id]/(portal)/admin/turmas/[turmaId]/page.tsx`
- `apps/web/src/app/escola/[id]/(portal)/admin/configuracoes/turmas/page.tsx`

APIs usadas:
- `/api/escola/[id]/admin/curriculo/status`
- `/api/escola/[id]/admin/curriculo/publish`
- `/api/escola/[id]/admin/curriculo/install-preset`
- `/api/escola/[id]/admin/curriculo/apply-preset`
- `/api/escola/[id]/admin/turmas/generate`
- `/api/escola/[id]/admin/turmas/[turmaId]/fecho`
- APIs de estrutura de apoio: cursos/classes/disciplinas no namespace `/api/escolas/[id]/*`

RPCs chave:
- `curriculo_publish`
- `gerar_turmas_from_curriculo`
- `curriculo_backfill_matriz_from_preset`
- `turma_set_status_fecho`
- `refresh_mv_turmas_para_matricula`

## 3.4 Configuracoes (hub admin)

UI principal:
- `apps/web/src/app/escola/[id]/(portal)/admin/configuracoes/page.tsx`
- `apps/web/src/app/escola/[id]/(portal)/admin/configuracoes/*`

Menu interno configuracoes:
- Calendario Academico
- Avaliacao & Notas
- Turmas & Curriculo
- Financeiro
- Mensalidades & Emolumentos
- Fluxos de Aprovacao
- Avancado

APIs chave:
- `/api/escola/[id]/admin/setup/status`
- `/api/escola/[id]/admin/setup/state`
- `/api/escola/[id]/admin/setup/impact`
- `/api/escola/[id]/admin/setup/preview`
- `/api/escola/[id]/admin/setup/commit`
- `/api/escola/[id]/admin/periodos-letivos`
- `/api/escola/[id]/admin/periodos-letivos/upsert-bulk`
- `/api/escola/[id]/admin/configuracoes/avaliacao-frequencia`
- `/api/escola/[id]/admin/configuracoes/financeiro`
- `/api/escola/[id]/admin/configuracoes/identidade`
- `/api/escola/[id]/admin/servicos`

RPCs de setup:
- `get_setup_state`
- `get_config_impact`
- `preview_apply_changes`
- `config_commit`
- `setup_active_ano_letivo`
- `upsert_bulk_periodos_letivos`

## 3.5 Fechamento academico/frequencias

API principal:
- `/api/escola/[id]/admin/frequencias/fechar-periodo` (GET status + POST fechamento)

Comportamento relevante para POP:
- POST exige `Idempotency-Key`.
- Chama RPC atomica `fechar_periodo_academico`.
- Dispara geracao de pauta oficial (PDF) e gravacao em storage (`pautas_oficiais_fechadas`).

## 3.6 Comunicacao e auditoria

UI/APIs:
- Avisos: `/api/escolas/[id]/admin/avisos`
- Eventos: `/api/escolas/[id]/admin/eventos` e `[eventId]`
- Relatorios/auditoria: tela `admin/relatorios/page.tsx` e API `/api/escola/[id]/admin/audit/recent`

## 3.7 Operacao e manutencao

APIs:
- `/api/escolas/[id]/admin/maintenance/refresh`
- `/api/escolas/[id]/admin/maintenance/partitions`
- `/api/escolas/[id]/admin/seed`

RPCs operacionais:
- `refresh_all_materialized_views`
- `partitions_info`
- `create_month_partition`
- `create_month_partition_ts`

## 4) Modelo de seguranca observado

Padrao dominante nas APIs admin:
- Autenticacao via Supabase session (`auth.getUser`).
- Resolucao de tenant/escola via `resolveEscolaIdForUser`.
- Checagem de role na escola via `rpc('user_has_role_in_school', ...)`.

Ponto importante para POP:
- A documentacao operacional deve separar claramente "acao permitida por perfil" (admin_escola, secretaria, admin, financeiro), pois varios endpoints aceitam combinacoes de papeis.

## 5) Dependencias de dados mapeadas (admin)

Top tabelas/views consultadas no namespace admin:
- `anos_letivos`, `alunos`, `classes`, `turmas`, `profiles`, `escola_users`
- `configuracoes_escola`, `configuracoes_financeiro`, `financeiro_tabelas`
- `curso_curriculos`, `curso_matriz`, `disciplinas_catalogo`, `periodos_letivos`
- `audit_logs`, `events`, `notices`, `servicos_escola`
- views `vw_*` listadas nas secoes anteriores

Top RPCs mapeadas no namespace admin:
- `user_has_role_in_school` (controle de permissao)
- `curriculo_publish`, `gerar_turmas_from_curriculo`, `config_commit`, `preview_apply_changes`
- `fechar_periodo_academico`, `upsert_bulk_periodos_letivos`, `setup_active_ano_letivo`

## 6) Achados para orientar o POP

- Existe mistura de namespaces `escola` e `escolas` para APIs admin; o POP deve esconder essa complexidade e instruir apenas pela jornada da tela.
- Ha reutilizacao de componentes/fluxos da secretaria dentro do admin (turmas, documentos, alunos). O POP precisa marcar quando o usuario esta em fluxo compartilhado.
- Existem paginas proxy/redirect (ex.: professores, operacoes academicas, calendario novo). O POP deve indicar caminho funcional final e nao apenas URL.
- Fluxos criticos usam idempotencia e/ou commit transacional por RPC; o POP deve incluir pre-condicoes (ex.: cabeçalho `Idempotency-Key` para operacoes de fechamento/commit quando aplicavel em chamadas API internas).

## 7) Base recomendada para construir POP final do usuario admin

Prioridade sugerida para o manual operacional:
1. Dashboard e leitura de indicadores
2. Alunos (consulta, filtros, alteracao, arquivar/restaurar)
3. Configuracao academica (ano letivo, periodos, avaliacao/frequencia)
4. Curriculo e turmas (publicar, gerar, revisar pendencias)
5. Fechamento de periodo e emissao de pauta oficial
6. Financeiro administrativo (parametros, servicos/mensalidades)
7. Avisos, eventos e auditoria
8. Rotinas de manutencao e contingencia

