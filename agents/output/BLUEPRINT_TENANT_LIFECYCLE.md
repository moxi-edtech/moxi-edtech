# KLASSE — Tenant Lifecycle Blueprint

## Diagrama (fluxo crítico)
```mermaid
flowchart TD
  A[Onboarding público /onboarding] -->|INSERT| B[onboarding_requests]
  B -->|RPC provisionar_escola_from_onboarding| C[escolas + anos_letivos + classes + turmas + financeiro_tabelas]
  D[/api/escolas/create] -->|RPC create_escola_with_admin| C
  C --> E[/api/escolas/{id}/onboarding/core/session]
  E -->|RPC setup_active_ano_letivo + upsert_bulk_periodos_letivos| F[anos_letivos + periodos_letivos + configuracoes_escola]
  F --> G[/api/escolas/{id}/onboarding/curriculum/apply-matrix]
  G -->|RPC onboard_academic_structure_from_matrix| H[cursos + classes + curso_curriculos + turmas]
  H --> I[/api/escola/{id}/admin/curriculo/apply-preset]
  I -->|applyCurriculumPreset| J[disciplinas_catalogo + curso_matriz + curso_curriculos]
  J --> K[/api/escola/{id}/admin/configuracoes/financeiro + /api/financeiro/tabelas]
  K --> L[/api/migracao/alunos/importar]
  L -->|RPC importar_alunos_v4| M[alunos + turmas + matriculas + import_errors]
  M -->|trigger gerar_mensalidades_nova_matricula| N[mensalidades + financeiro_lancamentos]
  N --> O[/api/professor/notas + /api/secretaria/notas]
  O -->|RPC lancar_notas_batch| P[avaliacoes + notas]
  P --> Q[MV vw_boletim_por_matricula]
  N --> R[/api/secretaria/balcao/pagamentos]
  R -->|RPC financeiro_registrar_pagamento_secretaria| S[pagamentos + mensalidades + financeiro_lancamentos]
  Q --> T[/api/secretaria/fechamento-academico]
  T --> U[/api/secretaria/rematricula + /confirmar]
  U -->|RPC rematricula_em_massa| V[novas matriculas + mensalidades]
  T --> W[/api/escolas/{id}/onboarding/session/rotate]
```

## 1) Setup Inicial & Onboarding (Dia 0)
- **Formulário público**
  - UI: `apps/web/src/app/onboarding/page.tsx`
  - DB: `onboarding_requests` (insert público)
- **Criação do tenant (admin cria escola)**
  - API: `POST /api/escolas/create`
  - RPC: `create_escola_with_admin`
  - Tabelas: `escolas`, `escola_administradores`, `profiles`, `escola_users`
- **Provisionamento a partir do pedido**
  - RPC: `provisionar_escola_from_onboarding`
  - Tabelas: `anos_letivos`, `classes`, `turmas`, `financeiro_tabelas`, `onboarding_requests`
- **Ano letivo inicial + períodos**
  - API: `POST /api/escolas/{id}/onboarding/core/session`
  - RPCs: `setup_active_ano_letivo`, `upsert_bulk_periodos_letivos`
  - Tabelas: `anos_letivos`, `periodos_letivos`, `configuracoes_escola`
- **Estrutura acadêmica (cursos/classes/turmas)**
  - API: `POST /api/escolas/{id}/onboarding/curriculum/apply-matrix`
  - RPC: `onboard_academic_structure_from_matrix`
  - Tabelas: `cursos`, `classes`, `curso_curriculos`, `turmas`, `turma_disciplinas`
- **Matriz curricular (disciplinas)**
  - API: `POST /api/escola/{id}/admin/curriculo/apply-preset`
  - Função: `applyCurriculumPreset`
  - Tabelas: `disciplinas_catalogo`, `curso_matriz`, `curso_curriculos`

## 2) Configuração Financeira e Académica
- **Config financeiro base**
  - API: `GET|POST /api/escola/{id}/admin/configuracoes/financeiro`
  - Tabelas: `configuracoes_financeiro`, `financeiro_tabelas`
- **Tabela de preços (curso/classe)**
  - API: `GET|POST /api/financeiro/tabelas`
  - Função: `resolveTabelaPreco`
  - Tabela: `financeiro_tabelas`
- **Motor de avaliação (herança)**
  - Base: `configuracoes_escola.avaliacao_config` + `modelos_avaliacao` default
  - Curso/Disciplina: `curso_matriz.avaliacao_mode`, `avaliacao_modelo_id`, `avaliacao_disciplina_id`
  - Resolução: `lib/academico/avaliacao-utils.ts` (`resolveModeloAvaliacao`)

## 3) Ingestão de Dados (Importação Excel)
- **Importação**
  - API: `POST /api/migracao/alunos/importar`
  - RPC: `importar_alunos_v4`
  - Tabelas: `staging_alunos`, `alunos`, `turmas`, `matriculas`, `import_errors`
- **Pré‑flight / validações**
  - Regras: `turma_codigo` válido, curso/classe existentes, currículo publicado, preços definidos
  - Falhas: registradas em `import_errors` + pendências em `import_financeiro_pendencias`
- **Geração financeira**
  - Trigger: `gerar_mensalidades_nova_matricula`
  - Tabelas: `mensalidades`, `financeiro_lancamentos`, `audit_logs`
  - Ajustes pós‑import: `aplicarContextoFinanceiro` (isenções e abonos quando aplicável)

## 4) Ciclo Operacional
- **Notas e avaliações**
  - APIs: `POST /api/professor/notas`, `POST /api/secretaria/notas`
  - RPC: `lancar_notas_batch`
  - Tabelas: `avaliacoes`, `notas`
- **GradeEngine e pautas**
  - Lib: `lib/pedagogico/grade-engine.ts` + `lib/pedagogico/pauta-geral.ts`
  - Fonte: `notas`, `curso_matriz`, `modelos_avaliacao`
- **Boletim materializado**
  - MV: `internal.mv_boletim_por_matricula`
  - View: `vw_boletim_por_matricula`
  - Cron: `refresh_mv_boletim_por_matricula`
- **Pagamentos**
  - API: `POST /api/secretaria/balcao/pagamentos`
  - RPC: `financeiro_registrar_pagamento_secretaria`
  - Tabelas: `pagamentos`, `mensalidades`, `financeiro_lancamentos`

## Atualização de Contrato (Status de Matrículas)
- **Fonte canônica:** `matriculas.ativo = true`.
- **Status text normalizado:** `ativo` (via `canonicalize_matricula_status_text`).
- **Compatibilidade:** `ACTIVE_MATRICULA_STATUSES` cobre `ativo`, `ativa`, `active` em rotas de leitura legadas.
- **Constraint:** `matriculas_numero_only_when_ativa` atualizado para exigir número quando `status = 'ativo'`.

## 5) Fim de Ano e Transição
- **Rematrícula em massa**
  - APIs: `POST /api/secretaria/rematricula`, `POST /api/secretaria/rematricula/confirmar`
  - RPC: `rematricula_em_massa`
  - Tabelas: `matriculas` (novas + status antigas), `mensalidades`
- **Sugestões de promoção**
  - API: `GET /api/secretaria/rematricula/sugestoes`
  - Tabelas: `turmas`, `classes`, `vw_secretaria_matriculas_turma_status`
- **Fechamento académico**
  - API: `POST /api/secretaria/fechamento-academico`
  - RPCs: `fechar_periodo_academico`, `finalizar_matricula_blindada`, `gerar_historico_anual`, `historico_set_snapshot_state`
  - Tabelas: `fechamento_academico_jobs`, `fechamento_academico_job_steps`, `audit_logs`
- **Rotação de ano letivo**
  - API: `POST /api/escolas/{id}/onboarding/session/rotate`
  - Tabelas: `anos_letivos`, `periodos_letivos`, `escolas.needs_academic_setup`

## Gargalos e Riscos
- **Invite code ausente no onboarding público**
  - O formulário `/onboarding` não valida `invite_code`/`codigo_convite` nem há endpoint/RPC associado.
- **Provisionamento do formulário público sem ligação em API**
  - Existe `provisionar_escola_from_onboarding`, mas não há rota acionando a RPC no código web.
- **Bloqueios de promoção só no frontend**
  - Resolvido: `rematricula_em_massa` valida inadimplência/reprovação e retorna motivos estruturados.
- **RPC `finalizar_matricula_blindada` não está nas migrations locais**
  - Resolvido: migration `20261215012000_add_finalizar_matricula_blindada.sql` adiciona a função.
- **Dependência de MV para fecho**
  - Mitigado: rotas de fechamento agora chamam `refresh_mv_boletim_por_matricula` antes do fecho.
