# Backlog Executavel - Correcao de Gargalos Operacionais

Versao: 1.0.0
Data: 2026-04-03
Base: `docs/roadmap-correcao-gargalos-operacionais-2026-04-03.md`
Fluxo alvo: `CURSO -> CURRICULO -> TURMAS -> HORARIOS -> PROFESSORES -> LANCAMENTOS`

## 1. Regras de execucao

- Ordem obrigatoria: `P0 -> P1 -> P2`.
- Cada ticket so fecha com:
1. codigo + teste
2. evidencia de execucao
3. validacao funcional
4. validacao de observabilidade
- Mudanca de contrato de API exige update de SOP/POP no mesmo ciclo.

## 2. Sprint board (resumo)

## P0 (D0-D2)

- BG-001: conflito no primeiro publish de horario (`EXECUTADO 2026-04-03`)
- BG-002: remover gate premium indevido em atribuicao de professor (`EXECUTADO 2026-04-03`)
- BG-003: atomicidade na criacao de professor (`EXECUTADO 2026-04-03 - hardening com compensacao`)

## P1 (D2-D5)

- BG-004: eliminar N+1 em disciplinas da turma (`EXECUTADO 2026-04-03`)
- BG-005: persistencia explicita no auto-completar do quadro (`EXECUTADO 2026-04-03`)

## P2 (D5-D8)

- BG-006: sincronizacao de turmas existentes apos publish de curriculo (`EXECUTADO 2026-04-03`)
- BG-007: transparencia operacional no skip de install-preset (`EXECUTADO 2026-04-03`)
- BG-008: contrato persistente curso->professor responsavel (`EXECUTADO 2026-04-03`)
- BG-009: atribuicao de professor em turma via RPC atomica (`EXECUTADO 2026-04-03`)
- BG-010: validacao de elegibilidade docente (skill/turno/carga) (`EXECUTADO 2026-04-03`)

## 3. Tickets detalhados

## BG-001 (P0)

Titulo:
- Validar conflito de professor/sala no primeiro publish do quadro

Severidade:
- HIGH

Arquivos/Endpoints alvo:
- `apps/web/src/app/api/escolas/[id]/horarios/quadro/route.ts`
- `POST /api/escolas/{id}/horarios/quadro`

Implementacao:
1. Executar validacao de conflito sempre que `mode === 'publish'`.
2. Nao condicionar validacao ao status atual da versao.
3. Manter retorno `409` com `conflicts` para UI.

Testes:
- API test: publish inicial com conflito -> `409`.
- API test: publish inicial sem conflito -> `200`.
- Regressao: save draft continua sem validacao de conflito global.

Criterio de aceite:
- Conflito nunca passa no primeiro publish.

Dependencias:
- nenhuma

Rollback:
- feature flag `HORARIO_PUBLISH_STRICT_CONFLICT`.

Status:
- EXECUTADO (2026-04-03)

## BG-002 (P0)

Titulo:
- Desacoplar atribuicao de professor de feature `doc_qr_code`

Severidade:
- HIGH

Arquivos/Endpoints alvo:
- `apps/web/src/app/api/secretaria/turmas/[id]/atribuir-professor/route.ts`
- `POST /api/secretaria/turmas/{id}/atribuir-professor`
- wrapper: `apps/web/src/app/api/escolas/[id]/turmas/[turmaId]/atribuir-professor/route.ts`

Implementacao:
1. Remover `requireFeature('doc_qr_code')` da rota de atribuicao.
2. Preservar apenas autorizacao por papel/escola.
3. Garantir que notificacao docente e upserts continuem intactos.

Testes:
- API test: escola sem `doc_qr_code` consegue atribuir professor.
- API test: usuario sem permissao continua bloqueado `403`.

Criterio de aceite:
- Fluxo de atribuicao funciona em planos `essencial/profissional`.

Dependencias:
- nenhuma

Rollback:
- flag `ATTRIBUICAO_PROFESSOR_REQUIRE_QR` (default OFF).

Status:
- EXECUTADO (2026-04-03)

## BG-003 (P0)

Titulo:
- Garantir atomicidade/compensacao na criacao de professor

Severidade:
- HIGH

Arquivos/Endpoints alvo:
- `apps/web/src/app/api/escolas/[id]/professores/create/route.ts`
- `POST /api/escolas/{id}/professores/create`
- `supabase/migrations/*` (nova RPC transacional de persistencia academica)

Implementacao:
1. Criar RPC transacional para bloco academico:
- `profiles` (upsert)
- `escola_users` (upsert professor)
- `professores` (upsert)
- `teachers` (upsert)
- `teacher_skills` (replace/upsert)
2. No endpoint, separar fase Auth (create user) e fase academica (RPC).
3. Se fase academica falhar apos criar usuario, executar compensacao controlada (desativar/registrar pendencia de reparo).
4. Retornar erro estruturado por etapa (`stage`).

Testes:
- sucesso completo -> todos os vinculos criados.
- falha simulada em `teachers` -> sem estado funcional parcial.
- idempotencia de reenvio com mesmo payload.

Criterio de aceite:
- zero estado parcial funcional no sucesso HTTP.

Dependencias:
- BG-002 pode rodar em paralelo.

Rollback:
- manter endpoint atual sob flag `PROF_CREATE_LEGACY_FLOW`.

Status:
- EXECUTADO (2026-04-03)
- Fase concluida: compensacao por etapas + RPC transacional dedicada `create_or_update_professor_academico`.

## BG-004 (P1)

Titulo:
- Remover N+1 em `GET turma disciplinas`

Severidade:
- MEDIUM

Arquivos/Endpoints alvo:
- `apps/web/src/app/api/secretaria/turmas/[id]/disciplinas/route.ts`
- `GET /api/secretaria/turmas/{id}/disciplinas`
- wrapper: `apps/web/src/app/api/escolas/[id]/turmas/[turmaId]/disciplinas/route.ts`

Implementacao:
1. Trocar loop com queries por consultas em lote:
- notas por `curso_matriz_id`
- presencas por `curso_matriz_id`
- quadro por `disciplina_id/professor_id`
2. Mapear resultados em memoria para montar payload final.
3. Preservar contrato de resposta atual.

Testes:
- snapshot de contrato JSON antes/depois.
- benchmark local/hml com turma de 16+ disciplinas.

Criterio de aceite:
- numero de queries deixa de crescer linearmente por disciplina.

Dependencias:
- nenhuma

Rollback:
- env toggle `TURMA_DISCIPLINAS_BATCH_MODE`.

Status:
- EXECUTADO (2026-04-03)

## BG-005 (P1)

Titulo:
- Evitar perda de trabalho no auto-completar do quadro

Severidade:
- MEDIUM

Arquivos/Endpoints alvo:
- `apps/web/src/app/escola/[id]/(portal)/horarios/quadro/page.tsx`
- `POST /api/escolas/{id}/horarios/auto`
- `POST /api/escolas/{id}/horarios/quadro`

Implementacao:
1. Apos `auto-completar`, mostrar estado "nao salvo" bloqueante visual.
2. Incluir CTA imediato `Salvar agora` (submit draft).
3. Alertar ao navegar para fora com mudancas nao persistidas.

Testes:
- UI test: auto-completar -> banner dirty + salvar.
- UI test: sair sem salvar -> confirmacao.

Criterio de aceite:
- usuario nao perde grade sem aviso.

Dependencias:
- nenhuma

Rollback:
- manter apenas banner sem bloqueio de navegação.

Status:
- EXECUTADO (2026-04-03)

## BG-006 (P2)

Titulo:
- Tornar sincronizacao de turmas existentes explicita no publish de curriculo

Severidade:
- MEDIUM (condicional)

Arquivos/Endpoints alvo:
- `apps/web/src/app/escola/[id]/(portal)/admin/configuracoes/turmas/page.tsx`
- `apps/web/src/app/api/escola/[id]/admin/curriculo/publish/route.ts`
- RPCs: `curriculo_publish*`, `curriculo_rebuild_turma_disciplinas`

Implementacao:
1. Expor claramente no frontend o efeito de `rebuildTurmas=true/false`.
2. Se `rebuild=false` e houver turmas existentes, exigir confirmacao forte.
3. Enriquecer resposta da API com status de sincronizacao executada.

Testes:
- publish com rebuild true -> turmas refletindo matriz publicada.
- publish com rebuild false -> warning e rastreabilidade.

Criterio de aceite:
- operador sabe exatamente se turmas foram sincronizadas.

Dependencias:
- BG-001 recomendado antes (governanca de publish).

Rollback:
- manter sem enriquecimento, com warning de UI temporario.

Status:
- EXECUTADO (2026-04-03)

## BG-007 (P2)

Titulo:
- Tornar skip de install-preset operacionalmente explicito

Severidade:
- MEDIUM

Arquivos/Endpoints alvo:
- `apps/web/src/app/api/escola/[id]/admin/curriculo/install-preset/route.ts`
- componentes de onboarding/oferta que consomem resposta

Implementacao:
1. Em `applied.skipped`, retornar:
- `skip_reason`
- `next_action`
- contexto de curso/ano
2. Mostrar mensagem de alto destaque com CTA correto na UI.
3. Registrar evento especifico de skip para telemetria operacional.

Testes:
- install em curso ja publicado -> resposta estruturada de skip.
- UI apresenta proximo passo sem ambiguidade.

Criterio de aceite:
- operador nao interpreta skip como sucesso de aplicacao.

Dependencias:
- BG-006 recomendado (mensageria de sincronizacao).

Rollback:
- manter payload atual com mensagem enriquecida.

Status:
- EXECUTADO (2026-04-03)

## 4. Plano de validacao (tecnica + negocio)

Checklist minimo por ticket:
1. Teste automatizado passando.
2. Smoke test em homologacao.
3. Validacao com 1 escola piloto.
4. Confirmacao de metricas 24h pos-release.

Consultas de verificacao recomendadas (DB):
- consistencia professor:
- `teachers` vs `escola_users` vs `professores`
- estados de horario:
- distribuicao `horario_versoes.status`
- latencia endpoint alvo:
- p95 antes/depois por rota

## 5. Observabilidade por ticket

Metrica minima por endpoint alterado:
- `requests_total`
- `error_rate`
- `latency_p95`
- `retries`

Dashboards obrigatorios:
- Horarios publish/save
- Atribuicao docente
- Criacao de professor
- Turma disciplinas
- Publish/install de curriculo

## 6. RACI de execucao

- Responsavel tecnico: Backend/API owner
- Responsavel funcional: Produto Academico
- Aprovacao operacional: Operacoes Escola
- Auditoria de release: Engenharia de Plataforma

## 7. Definicao de conclusao da onda

A onda fecha quando:
1. todos os tickets `P0` em `DONE`
2. `P1` concluido ou com mitigacao ativa aprovada
3. sem regressao critica em 7 dias
4. SOP/POP atualizados nos fluxos impactados
