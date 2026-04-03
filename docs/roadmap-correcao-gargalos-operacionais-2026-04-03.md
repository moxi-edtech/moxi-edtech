# Roadmap de Correcao Imediata - Gargalos Operacionais

Versao: 1.5.0
Data: 2026-04-03
Escopo: Fluxo `CURSO -> CURRICULO -> TURMAS -> HORARIOS -> PROFESSORES -> LANCAMENTOS`
Origem: Auditoria tecnica baseada no codigo (portal Admin/Secretaria)
Atualizado em: 2026-04-03 (execucao P0+P1+P2+P3 observabilidade+guardrail+sync_mode+orquestrador transacional)

## 1. Objetivo

Corrigir, com prioridade imediata, os gargalos operacionais de maior risco para producao, reduzindo:
- falhas de consistencia no fluxo academico
- bloqueios indevidos de operacao
- degradacao de performance em escala
- perda de trabalho operacional na interface

## 2. Escopo desta onda (imediata)

Entram nesta onda os 7 achados abaixo, com foco em hotfix seguro e verificavel.

1. HIGH: conflito de horario no primeiro publish
2. HIGH: atribuicao de professor bloqueada por feature premium nao relacionada
3. HIGH: criacao de professor sem transacao fim-a-fim
4. MEDIUM: N+1 em disciplinas da turma
5. MEDIUM: auto-completar horario sem persistencia
6. MEDIUM: publish de curriculo sem propagacao para turmas existentes
7. MEDIUM: install-preset com skip sem sinalizacao operacional forte

## 3. Validacao remota de DB (executada em 2026-04-03)

Fonte de validacao:
- conexao SQL remota via `.env.db` no projeto
- introspeccao de `constraints`, `indexes`, `functions` e amostra de dados operacionais

Evidencias objetivas:
1. Conflito no primeiro publish:
- `public.publish_horario_versao` apenas arquiva/publica versoes; nao valida conflito professor/sala.
- `public.upsert_quadro_horarios_versao_atomic` tambem nao faz essa validacao (ela esta no endpoint HTTP antes do RPC).

2. Gate premium em atribuicao docente:
- tabela `public.app_plan_limits`: `doc_qr_code = false` para planos `essencial` e `profissional`; `true` apenas em `premium`.
- confirma alto risco de bloqueio indevido quando a rota de atribuicao depende dessa feature.

3. Integridade do bloco professor:
- indices de unicidade existem em `teachers` (`teachers_escola_profile_uidx`), mas `professores` nao tem unique por `(escola_id, profile_id)`.
- checagem de consistencia atual encontrou `1` registro em `teachers` sem par em `professores` (legado), confirmando risco de estado parcial/assimetria.

4. Publicacao de curriculo e propagacao:
- `public.curriculo_publish_single` chama `public.curriculo_rebuild_turma_disciplinas(...)` quando `p_rebuild_turmas = true`.
- logo, o risco de nao propagar para turmas existentes e condicional (acontece quando `rebuildTurmas` vai `false` no fluxo UI).

5. Escala atual (amostra):
- `turmas=97`, `turma_disciplinas=386`, `quadro_horarios=115`, `notas=35`.
- p95 de disciplinas por turma = `16`.
- volume atual ainda comportavel, mas o padrao N+1 permanece fragil para crescimento.

## 4. Priorizacao operacional

- P0 (D0-D2): itens HIGH (1, 2, 3)
- P1 (D2-D5): itens MEDIUM com impacto direto em operacao diaria (4, 5)
- P2 (D5-D8): itens MEDIUM de consistencia de ciclo academico (6, 7)

## 4.1 Status de execucao (real)

1. BG-001 (HIGH) - EXECUTADO
- arquivo: `apps/web/src/app/api/escolas/[id]/horarios/quadro/route.ts`
- resultado: validacao de conflito agora roda em `mode=publish` tambem no primeiro publish.

2. BG-002 (HIGH) - EXECUTADO
- arquivo: `apps/web/src/app/api/secretaria/turmas/[id]/atribuir-professor/route.ts`
- resultado: removido gate indevido de `doc_qr_code` da atribuicao de professor.

3. BG-003 (HIGH) - EXECUTADO
- arquivo: `apps/web/src/app/api/escolas/[id]/professores/create/route.ts`
- migration: `supabase/migrations/20270403123000_professor_create_academic_atomic_rpc.sql`
- resultado: compensacao por etapa + RPC transacional dedicada para persistencia academica (`profiles`, `escola_users`, `professores`, `teachers`, `teacher_skills`).

4. BG-004 (MEDIUM) - EXECUTADO
- arquivo: `apps/web/src/app/api/secretaria/turmas/[id]/disciplinas/route.ts`
- resultado: eliminado padrao N+1 com consultas em lote para `notas`, `presencas` e `quadro_horarios`.

5. BG-005 (MEDIUM) - EXECUTADO
- arquivo: `apps/web/src/app/escola/[id]/(portal)/horarios/quadro/page.tsx`
- resultado: estado "nao salvo" apos auto-completar, alerta de saida de pagina, confirmacao ao trocar turma e CTA "Salvar agora".

6. BG-006 (MEDIUM) - EXECUTADO
- arquivos:
  - `apps/web/src/app/api/escola/[id]/admin/curriculo/publish/route.ts`
  - `apps/web/src/app/escola/[id]/(portal)/admin/configuracoes/turmas/page.tsx`
- resultado:
  - confirmacao obrigatoria quando `rebuildTurmas=false` com turmas existentes (`CURRICULO_REBUILD_CONFIRM_REQUIRED`).
  - payload enriquecido com `sync_turmas` (`rebuild_executado`, `turmas_afetadas`, contagens before/after).

7. BG-007 (MEDIUM) - EXECUTADO
- arquivos:
  - `apps/web/src/app/api/escola/[id]/admin/curriculo/install-preset/route.ts`
  - `apps/web/src/components/escola/settings/StructureMarketplace.tsx`
  - `apps/web/src/components/escola/onboarding/AcademicSetupWizard.tsx`
- resultado:
  - `applied.skipped` com motivo estruturado, `reason_code` e `recommended_action`.
  - evento operacional `curriculo.install_preset_skipped`.
- frontend deixa de reportar "sucesso" cego quando houve skip.

8. BG-008 (HIGH) - EXECUTADO
- arquivos:
  - `apps/web/src/app/api/escolas/[id]/cursos/[cursoId]/professor/route.ts`
  - `apps/web/src/app/api/escolas/[id]/cursos/route.ts`
  - `supabase/migrations/20270403180000_curso_professor_responsavel_and_atribuicao_atomic.sql`
- resultado:
  - criado contrato real para `CURSO -> PROFESSOR RESPONSAVEL` com tabela dedicada (`curso_professor_responsavel`) e RPCs (`set_curso_professor_responsavel`, `get_curso_professor_responsavel_map`).
  - endpoint `PUT /api/escolas/{id}/cursos/{cursoId}/professor` agora persiste de fato e `GET /api/escolas/{id}/cursos` passa a devolver `professor_id`.

9. BG-009 (HIGH) - EXECUTADO
- arquivos:
  - `apps/web/src/app/api/secretaria/turmas/[id]/atribuir-professor/route.ts`
  - `supabase/migrations/20270403180000_curso_professor_responsavel_and_atribuicao_atomic.sql`
- resultado:
  - atribuicao de professor em turma passou a usar RPC atomica (`assign_professor_turma_disciplina_atomic`), removendo risco de estado parcial entre `turma_disciplinas` e `turma_disciplinas_professores`.

10. BG-010 (MEDIUM) - EXECUTADO
- arquivos:
  - `apps/web/src/app/api/secretaria/turmas/[id]/atribuir-professor/route.ts`
  - `supabase/migrations/20270403180000_curso_professor_responsavel_and_atribuicao_atomic.sql`
- resultado:
  - validacoes de elegibilidade docente incorporadas antes da gravacao: `teacher_skills`, compatibilidade de turno e bloqueio por carga maxima.

11. BG-011 (HIGH) - EXECUTADO
- arquivos:
  - `apps/web/src/app/api/escolas/[id]/horarios/quadro/route.ts`
  - `apps/web/src/app/api/escolas/[id]/professores/create/route.ts`
  - `apps/web/src/app/api/secretaria/turmas/[id]/atribuir-professor/route.ts`
- resultado:
  - instrumentacao operacional adicionada nos 3 endpoints criticos sem alterar regra de negocio.
  - eventos agora carregam `status`, `http_status`, `duration_ms`, ids de contexto e codigo de erro.
  - tipos emitidos:
    - `academico.horario_quadro_post`
    - `academico.professor_create`
    - `academico.atribuir_professor_turma`

12. BG-012 (HIGH) - EXECUTADO
- arquivos:
  - `supabase/migrations/20270403193000_professor_operational_consistency_guardrail.sql`
  - `apps/web/src/app/api/escola/[id]/admin/academico/consistencia-professores/route.ts`
- resultado:
  - criado guardrail de consistencia operacional para o fluxo docente completo.
  - checagens objetivas no banco para:
    - `teachers` sem `professores`
    - `professores` sem `teachers`
    - duplicidade de `professores` por `profile_id`
    - `teacher_skills` com escola divergente
    - alocacoes `turma_disciplinas_professores` sem `teacher` correspondente
    - alocacoes sem `teacher_skills` para a disciplina
  - endpoint Admin para execucao controlada e resumo:
    - `GET /api/escola/{id}/admin/academico/consistencia-professores?limit=20`
  - evento operacional de execucao:
    - `academico.consistencia_professores_checked`

13. BG-013 (HIGH) - EXECUTADO
- arquivo:
  - `apps/web/src/app/api/escola/[id]/admin/curriculo/publish/route.ts`
- resultado:
  - contrato explicito de sincronizacao para turmas existentes:
    - `syncMode: additive | reconcile`
    - `confirmReconcileSync` para modo `reconcile`
  - `sync_existing_turmas` agora retorna:
    - `obsolete_count` + `obsolete_sample`
    - `reconcile_removed`, `reconcile_blocked`
    - `reconcile_pending_confirmation`
  - modo `additive` permanece padrao operacional.
  - modo `reconcile` so remove vinculos obsoletos seguros apos confirmacao explicita.

14. BG-014 (HIGH) - EXECUTADO
- arquivo:
  - `apps/web/src/app/api/escola/[id]/admin/curriculo/install-preset/route.ts`
  - `supabase/migrations/20270403221000_curriculo_install_orchestrated_atomic.sql`
- resultado:
  - fluxo `install-preset` passou a executar por RPC orquestradora unica e transacional no banco:
    - `curriculo_install_orchestrated(escola, preset, ano, autoPublish, generateTurmas, customData, advancedConfig, idempotency)`
  - etapas unificadas em uma transacao unica:
    - `apply -> publish -> backfill_matriz -> generate_turmas`
  - retorno operacional por etapa:
    - `apply`, `publish`, `backfill_matriz`, `generate_turmas`
  - com a RPC disponivel, falhas internas fazem rollback completo (sem estado parcial confirmado).
  - rota preserva fallback legado apenas quando a RPC ainda nao existe no ambiente (erro `42883`).

Validacao executada no lote:
- `pnpm -C apps/web exec tsc --noEmit` (ok)
- `pnpm -C apps/web lint` (sem erros; warnings legados)
- testes unitarios adicionados:
  - `apps/web/src/lib/academico/curriculo-operacao.ts`
  - `apps/web/tests/unit/curriculo-operacao.spec.ts`
- script atualizado: `apps/web/package.json` (`test:unit:fuzz` inclui novo spec)
- execucao: `pnpm -C apps/web run test:unit:fuzz` (12/12 passando)

## 5. Plano por achado

## 5.1 HIGH-01 - Conflito de horario no primeiro publish

Referencia:
- `apps/web/src/app/api/escolas/[id]/horarios/quadro/route.ts`

Risco:
- publicar quadro com conflito professor/sala no primeiro ciclo de publicacao.

Correcao imediata:
1. Mover validacao de conflito para executar quando `mode === 'publish'`, independente do status atual da versao.
2. Garantir que a busca de conflitos compare contra versoes `publicada` da escola e exclua a versao corrente.
3. Cobrir com teste de API: primeiro publish com conflito deve retornar 409.

Criterio de aceite:
- primeiro publish com conflito retorna `409` e payload `conflicts`.
- publish sem conflito continua retornando `ok: true`.

Rollback:
- feature flag de validacao estrita no publish (default ON no ambiente alvo).

## 5.2 HIGH-02 - Atribuicao de professor bloqueada por feature premium

Referencia:
- `apps/web/src/app/api/secretaria/turmas/[id]/atribuir-professor/route.ts`

Risco:
- fluxo academico essencial bloqueado por dependencia de plano (`doc_qr_code`).

Correcao imediata:
1. Remover gate `requireFeature('doc_qr_code')` desta rota de atribuicao.
2. Se necessario, mover gating para endpoint/acao realmente vinculada a documento QR.
3. Cobrir com teste de permissao: usuario autorizado sem feature premium deve conseguir atribuir.

Criterio de aceite:
- atribuicao funciona para escola elegivel por permissao, sem dependencia de feature premium irrelevante.

Rollback:
- reintroduzir guard apenas sob flag e somente para casos funcionais correlatos.

## 5.3 HIGH-03 - Criacao de professor sem atomicidade

Referencia:
- `apps/web/src/app/api/escolas/[id]/professores/create/route.ts`

Risco:
- estados parciais (usuario criado, mas sem `teachers`/`teacher_skills` consistentes).

Correcao imediata:
1. Introduzir operacao atomica no backend de dados para vinculos academicos (profile/escola_user/professores/teachers/skills) via RPC transacional.
2. Manter criacao de usuario auth separada, mas com compensacao explicita em falha de persistencia academica.
3. Retornar erro estruturado por etapa (`auth`, `profile`, `teacher`, `skills`) para suporte.
4. Registrar auditoria de falha parcial com `run_id` de correlacao.

Criterio de aceite:
- nenhum caso de perfil parcialmente criado sem teacher vinculado apos sucesso HTTP.
- falha em etapa interna retorna erro claro e nao deixa lixo funcional.

Rollback:
- fallback para fluxo atual com compensacao manual habilitada por script operacional.

## 5.4 MEDIUM-01 - N+1 em disciplinas da turma

Referencia:
- `apps/web/src/app/api/secretaria/turmas/[id]/disciplinas/route.ts`

Risco:
- latencia crescente por turma com muitas disciplinas/alunos.

Correcao imediata:
1. Eliminar consultas por item no loop (`notas`, `quadro_horarios`, `presencas`).
2. Substituir por consultas agregadas em lote (por `turma_id` + conjunto de `curso_matriz_id`/`disciplina_id`).
3. Reagrupar em memoria para montar payload final.

Criterio de aceite:
- reduzir numero de queries por request para padrao constante (O(1) por turma, nao O(n) por disciplina).
- p95 da rota reduzido de forma mensuravel em carga de homologacao.

Rollback:
- manter endpoint legado com toggle de estrategia de consulta.

## 5.5 MEDIUM-02 - Auto-completar sem persistencia

Referencia:
- `apps/web/src/app/escola/[id]/(portal)/horarios/quadro/page.tsx`

Risco:
- operador acredita que concluiu, mas perde distribuicao ao sair da tela.

Correcao imediata:
1. Apos `auto-completar` bem-sucedido (`dry_run`), oferecer acao explicita `Salvar agora` com submit imediato de draft.
2. Exibir alerta de estado sujo enquanto nao houver persistencia.
3. Opcional nesta onda: parametro de auto-completar com persistencia direta controlada por confirmacao.

Criterio de aceite:
- usuario recebe aviso claro de que grade ainda nao foi salva.
- existe caminho de 1 clique para persistir o resultado gerado.

Rollback:
- manter apenas comportamento atual com banner de aviso (sem auto-save).

## 5.6 MEDIUM-03 - Publish de curriculo sem propagacao em turmas existentes (condicional)

Referencia:
- `apps/web/src/app/api/escola/[id]/admin/curriculo/publish/route.ts`

Risco:
- condicional: ocorre quando publicacao e feita com `rebuildTurmas=false` em fluxo que deveria sincronizar turmas ja existentes.

Correcao imediata:
1. Tornar o comportamento de `rebuildTurmas` explicito na UI (impacto e consequencia).
2. Se `rebuildTurmas=false` e houver turmas existentes, exibir bloqueio ou warning hard-stop com confirmacao forte.
3. Sincronizar `turma_disciplinas` das turmas existentes com a matriz publicada (modo aditivo, sem rebuild destrutivo).
4. Retornar no payload do publish o estado de sincronizacao (`rebuild_executado`, `turmas_afetadas`) e o bloco `sync_existing_turmas`.

Criterio de aceite:
- publish informa estado de propagacao para turmas existentes (`sync_existing_turmas`).
- operador consegue executar sync sem procedimento manual difuso.
- smoke funcional comprova insercao de vinculos em `turma_disciplinas` para disciplina nova apos publish sem rebuild.

Rollback:
- manter comportamento atual com warning obrigatorio em UI e SOP.

Status:
- CONCLUIDO (2026-04-03)
- Implementado em `apps/web/src/app/api/escola/[id]/admin/curriculo/publish/route.ts`:
  - `syncPublishedMatrizToExistingTurmas(...)`
  - payload `sync_existing_turmas` no retorno
- UX alinhada em `apps/web/src/app/escola/[id]/(portal)/admin/configuracoes/turmas/page.tsx` com mensagem de sincronizacao de turmas existentes.
- Smoke controlado validado (homolog):
  - `publish_http=200`
  - `sync_existing_turmas.executed=true`
  - `sync_existing_turmas.inserted=38`
  - disciplina de teste propagada para turma existente da classe-alvo (`before=0`, `after=1`)

## 5.7 MEDIUM-04 - Install-preset com skip opaco

Referencia:
- `apps/web/src/app/api/escola/[id]/admin/curriculo/install-preset/route.ts`

Risco:
- percepcao de sucesso sem mudanca efetiva no curso.

Correcao imediata:
1. Quando `applied.skipped`, retornar motivo estruturado e acao recomendada (`publicado_existente`, `usar fluxo de revisao/publicacao`).
2. Exibir feedback de alto destaque no frontend com CTA correto.
3. Registrar evento operacional especifico de skip com contexto do curso/ano.

Criterio de aceite:
- operador entende claramente por que nao houve aplicacao.
- existe proximo passo direto na resposta/UI.

Rollback:
- manter skip atual apenas com mensagem textual enriquecida.

## 6. Cronograma de execucao

## Fase D0-D2 (P0)

- HIGH-01: conflito no primeiro publish
- HIGH-02: remover gate premium indevido
- HIGH-03: plano de atomicidade + primeira versao com compensacao

Entrega:
- patch backend
- testes de regressao dos 3 cenarios
- release notes de risco
- Status: CONCLUIDO (2026-04-03)

## Fase D2-D5 (P1)

- MEDIUM-01: refactor de consultas em lote
- MEDIUM-02: persistencia/alerta do auto-completar

Entrega:
- melhoria de performance validada em homologacao
- ajuste de UX operacional do quadro
- Status: CONCLUIDO (2026-04-03)

## Fase D5-D8 (P2)

- MEDIUM-03: propagacao para turmas existentes
- MEDIUM-04: transparência de skip no install

Entrega:
- consistencia de ciclo curriculo->turmas
- feedback operacional inequívoco no onboarding/oferta
- Status: CONCLUIDO (2026-04-03)

## 7. Observabilidade obrigatoria (go-live)

Medir por endpoint:
- taxa de erro (4xx/5xx)
- latencia p50/p95/p99
- volume por minuto
- retries/reexecucoes por operador

Endpoints foco:
- `/api/escolas/{id}/horarios/quadro` (publish/draft)
- `/api/secretaria/turmas/{id}/atribuir-professor`
- `/api/escolas/{id}/professores/create`
- `/api/secretaria/turmas/{id}/disciplinas`
- `/api/escola/{id}/admin/curriculo/publish`
- `/api/escola/{id}/admin/curriculo/install-preset`

Alertas recomendados:
- erro > 2% por 15 min em endpoints P0
- p95 acima do baseline acordado por 30 min
- aumento anomalo de retries no publish de quadro/curriculo

Fonte operacional padronizada (implementada):
- tabela/event stream `eventos` com `tipo`:
  - `academico.horario_quadro_post`
  - `academico.professor_create`
  - `academico.atribuir_professor_turma`
- campos minimos para monitoracao:
  - `payload.status`
  - `payload.http_status`
  - `payload.duration_ms`
  - `payload.error_code` (quando erro)
  - chaves de contexto (`turma_id`, `curso_matriz_id`, `teacher_id`, etc)

## 8. Definicao de pronto (DoD)

1. Correcoes implantadas com teste automatizado dos cenarios criticos.
2. Sem regressao funcional nos fluxos de Admin/Secretaria.
3. SOPs/POPs refletindo comportamento final (quando aplicavel).
4. Monitoramento ativo com dashboard e alertas dos endpoints foco.
5. Janela de observacao pos-release com checklist de estabilidade.

## 9. Riscos de implantacao e mitigacao

- Risco: alteracao de regra no publish impactar rotina atual.
- Mitigacao: deploy gradual com flag + smoke test por escola piloto.

- Risco: refactor de query alterar payload esperado no frontend.
- Mitigacao: contrato de resposta congelado + testes de snapshot/API.

- Risco: compensacao de create professor gerar efeitos colaterais.
- Mitigacao: trilha de auditoria por etapa e script de reparo controlado.

## 10. Proxima acao recomendada

Executar ciclo de estabilizacao pos-correcao:
1. monitorar por 7 dias os endpoints foco (erro/latencia/retry)
2. monitorar consistencia `teachers`/`professores` por 7 dias apos deploy
3. capturar feedback operacional de 1-2 escolas piloto para ajuste fino de UX/SOP
