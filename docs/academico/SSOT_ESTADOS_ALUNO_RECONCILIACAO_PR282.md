# SSOT do ciclo de vida do aluno — conciliação transversal (PR #282)

**Data da auditoria:** 2026-10-28  
**Âmbito:** todas as escolas, todos os alunos e todos os anos (não apenas 2026/2027).  
**Estado em 28/10/2026:** dez migrações do SSOT aplicadas no Supabase e espelhadas nesta PR; **um vínculo histórico inequívoco foi conciliado com auditoria**. Nenhuma nota, aprovação ou snapshot foi alterado. O inventário da secção 3 documenta o diagnóstico anterior às correções.  
**Ferramenta:** [`supabase/ops/scripts/audit_student_lifecycle_statuses.sql`](../../supabase/ops/scripts/audit_student_lifecycle_statuses.sql).  
**Contrato existente:** [`CONTRATO_ESTADOS_MATRICULA_REMATRICULA.md`](../CONTRATO_ESTADOS_MATRICULA_REMATRICULA.md).

## 1. O que a PR #282 resolve e o que não resolve

A PR #282 corrige seleção da sessão MED, classes sem número, destino/turma, regras RAA e recuperação da janela de rematrícula. Não é uma migração global do estado dos alunos. **Não associar a correção do dropdown à aprovação do ano anterior.** A mesma matrícula pode ter UI recuperada e histórico académico ainda não consolidado.

Esta contribuição acrescenta um inventário global por **escola + aluno + matrícula + ano** e uma política de conciliação com zero alteração a dados. A conciliação efetiva de cada resultado deve ocorrer apenas mediante evidência e autorização escolar.

## 2. Fontes de verdade — separadas por responsabilidade

| Pergunta | Fonte oficial existente | Como compor a leitura |
|---|---|---|
| A matrícula existe, está ativa ou terminou? | `matriculas` (`status`, `ativo`, `data_fecho`, `motivo_fecho`) | `ativo = true` é o indicador atual de matrícula operacional; compatibilizar variantes legadas de `status`. |
| O aluno foi aprovado, retido ou concluiu o ciclo? | RAA `resolve_raa_progression_for_matricula`, decisão oficial e `historico_anos.resultado_final` | Não inferir apenas de `matriculas.status`, idade, nome da classe, turma destino ou pagamento. |
| O resultado está congelado legalmente? | `historico_anos.snapshot_status` e `historico_snapshot_locks` | `aberto` não é comprovativo de fecho oficial. Respeitar `fechado/reaberto`. |
| A rematrícula pode ser confirmada? | RPCs canónicas de progressão/rematrícula + matrícula destino + janela | Derivar elegibilidade; não persistir `DEBT_BLOCKED`, `WINDOW_CLOSED` etc. como status do aluno. |
| Uma obrigação foi liquidada? | `mensalidades`, ledger e `servico_pedidos` | Financeiro é um eixo independente, não decide aprovação académica. |
| A candidatura foi convertida? | `candidaturas.matricula_id` + `candidaturas.status` | `matriculado` na candidatura significa **conversão histórica**, não que a matrícula daquele ano esteja ativa hoje. |

**Contrato de leitura pretendido:** `{ matricula: estado_operacional, academico: resultado_e_proveniencia, elegibilidade: impedimentos_e_proxima_acao }`. Não introduzir um `alunos.status` global paralelo.

**Alvo semântico de longo prazo (não gravar agora):**
- Matrícula: `pendente | ativa | encerrada | cancelada`; transferência/desistência/anulação são motivos ou eventos auditáveis de fecho, não aprovação.
- Resultado académico: `pendente | aprovado | reprovado | concluido`, com indicação de fonte e oficialidade; dependência/recurso/inscrição condicional são decisões e condições RAA, não estados de matrícula.
- Solicitação de rematrícula: interpretação dos pedidos e matrículas existentes, sem criar uma segunda máquina de estados.
- Os 21 códigos operacionais do Balcão servem para **motivo, orientação e ação** da interface; não são 21 estados persistentes do aluno.

**Compatibilidade:** a base atual utiliza `matriculas.status = 'concluido'` para encerrar a matrícula, além de variantes `ativo/ativa/active` e `transferido`. A documentação existente ainda usa ocasionalmente `reprovado` como status físico. Antes de qualquer alteração estrutural, normalizar a **leitura** e preservar o valor bruto e a proveniência.

## 3. Achados da execução no banco (2026-10-28)

| Escola | Regra | Matrículas/alunos na fila | Gravidade |
|---|---|---:|---|
| Curtume | `ORIGEM_PENDENTE_COM_DESTINO_ATIVO` (2025 → 2026) | **300** | Revisão da decisão/fecho |
| Curtume | `ANO_ENCERRADO_COM_MATRICULA_PENDENTE` (2025, sem destino ativo ligado) | **250** | Revisão de histórico/legado |
| Curtume | `HISTORICO_ABERTO_APOS_ANO` | **13** | Revisão de fecho legal |
| Curtume | `CONCLUSAO_SEM_HISTORICO_VINCULADO` | **1** | Rever vínculo e snapshot |
| Escola KLASSE | `CONCLUSAO_SEM_HISTORICO_VINCULADO` | **1** | Rever vínculo e snapshot |
| Curtume | `HISTORICO_SEM_MATRICULA_VINCULADA` | **1** | Identificar ligação histórica inequívoca |

Na execução deste inventário, não surgiram ocorrências das regras classificadas como `CRITICO`. **Isso não constitui homologação exaustiva de RLS, transações ou decisões académicas.** Pode haver mais do que uma anomalia por matrícula; os totais das regras não são necessariamente um total único de alunos.

Também foram consultadas `fechamento_academico_jobs` e `historico_snapshot_locks`: ambas tinham **zero registos**, pelo que não há evidência no remoto de fecho orquestrado e bloqueio legal para os casos históricos verificados.

Dos 14 históricos de 2025 do Curtume com snapshot `aberto`, 13 têm `matricula_id` e um não tem vínculo por matrícula; a auditoria reporta este último separadamente. Não associar históricos por homonímia.

Os 300 casos com destino ativo têm motivo e `status_fecho_origem = 'manual'`, mas a origem permanece `pendente`, sem `data_fecho` e sem `historico_anos` ligado. **Não interpretar a existência do destino como prova de aprovação.** Pode representar migração histórica assistida, não conclusão homologada.

## 4. Runbook para conciliar sem inventar resultados

1. Executar `audit_student_lifecycle_statuses.sql` com credenciais de operador autorizado; guardar os resultados em ambiente privado. O script é uma **consulta SELECT** e não modifica dados.
2. Agrupar por escola, ano, código e matrícula. Resolver conflitos de tenant, duplicidade ativa e origem inexistente antes dos casos legados. Não unir alunos homónimos.
3. Para `ORIGEM_PENDENTE_COM_DESTINO_ATIVO`: recuperar ato de promoção/retenção/conclusão, notas/frequências ou declaração administrativa específica autorizada; consultar decisão RAA, turma e ano real. Se faltar prova, **manter em revisão**; não escrever `aprovado` em lote.
4. Para `ANO_ENCERRADO_COM_MATRICULA_PENDENTE`: separar reserva, desistência, matrícula nunca efetivada e matrícula histórica com decisão não importada. `pendente` não é reprovação.
5. Para histórico ausente/aberto: primeiro resolver resultados e eventuais vínculos inequívocos; gerar e congelar histórico **pelo mecanismo oficial de fechamento**, com auditoria e política de retificação. Nunca atualizar `snapshot_status` diretamente.
6. Apenas após revisão escolar, preparar proposta de alterações por matrícula com `before/after`, escola, ano, fundamento, autor, audit trail e operação idempotente. Testar em réplica estrutural e executar lote pequeno com rollback/reconciliação previstos; reexecutar a consulta antes e depois.
7. Verificar Portal do Aluno, Secretaria, Balcão, financeiro e emissão de documentos com os mesmos IDs e ano letivo. Uma correção de fecho não cria uma nova matrícula, dívida ou recibo.

## 5. Critérios de aceitação do SSOT

- Uma única matrícula operacional ativa por aluno/escola/ano; nenhuma transição entre escolas sem operação formal.
- Nenhuma origem histórica permanece `pendente` **quando uma decisão oficial de conclusão está comprovada**; sem prova, a pendência deve ser explicitada, não escondida.
- Nenhum status académico é inferido do valor `transferido`, de classe com `numero NULL`, da janela financeira ou da matrícula destino.
- Uma mesma decisão RAA governa Balcão, Portal, lote e fechamento; tentativas repetidas são idempotentes.
- Resultado e snapshot têm proveniência e eventos de auditoria; documentos já emitidos respeitam bloqueio/reabertura legal.
- A UI comunica estado, causa e próxima ação no mesmo contexto, incluindo revisão de histórico e solução de bloqueios.
- Read model consistente para *todos os alunos*, sem leituras cruzadas entre escolas e sem adicionar um segundo campo de status global.

**Ponto de integração:** a PR #282 pode manter-se draft enquanto se executa esta auditoria. A normalização física de dados legados e qualquer migração de enum/coluna devem ficar em alteração separada, após decisão escolar e homologação autenticada.

## 6. Implementação de leitura e consumidores — 28/10/2026

Foi entregue uma **projeção SSOT em TypeScript** sem migração de dados ou alteração de regras RAA:

- `apps/web/src/lib/matriculas/student-lifecycle.ts`: `construirCicloVidaAluno` separa estado operacional, resultado registado, resultado **oficial** (apenas com snapshot `fechado`), motivos de fecho e pendências auditáveis.
- `apps/web/src/lib/matriculas/load-student-lifecycle.ts`: leituras limitadas à **mesma escola e aluno** de `matriculas` e `historico_anos`; erro não vira resultado académico fictício.
- `GET /api/secretaria/alunos/[id]/lifecycle`: novo endpoint autenticado, `requireRoleInSchool` e `no-store` para consulta da Secretaria; não escreve dados.

Consumidores existentes já alinhados à mesma projeção (preservando payload/contratos legados):

| Consumidor | Rota ou componente | Comportamento |
|---|---|---|
| Dossiê da Secretaria / Command Center | `GET /api/secretaria/alunos/[id]/dossier` | Retorna `cicloVida` e indicador `cicloVidaIndisponivel` sem bloquear o dossiê. |
| Linha temporal do aluno | `GET /api/secretaria/alunos/[id]/timeline-360` | Acrescenta `cicloVida`; histórico financeiro e académico existente continua preservado. |
| Matrícula do ano corrente | `GET /api/secretaria/alunos/[id]/matricula-corrente`, `CurrentYearEnrollmentPanel` | Distingue matrícula encerrada/cancelada de matrícula ausente; mantém confirmação transacional via RPC. |
| Portal do Aluno | `GET /api/aluno/home/status` | Não confunde matrícula mais recentemente criada com ano mais atual; mostra resultado como oficial apenas com snapshot fechado; mantém fallback quando o read model está indisponível. |
| Pedido do aluno | `GET /api/aluno/rematricula/status` | Acrescenta projeção contextual nos caminhos conhecidos; RAA e gates financeiros continuam governando elegibilidade. |
| Balcão | `GET /api/secretaria/balcao/rematriculas/status`, `useRematriculaBalcao`, `RematriculaBalcaoModal` | Avisa sobre históricos anteriores por conciliar; mantém sessão MED, turma destino, RAA, idempotência e pagamento canónicos. |
| Histórico do Balcão de pagamentos | `PagamentosPendentesWindow` | Usa o mesmo `cicloVida` no modal de rematrícula. |
| Alteração manual legada | `PUT /api/secretaria/matriculas/[matriculaId]/status`, `StatusForm`, `MatriculasListClient` | Impede escrita direta que mudaria apenas `status` sem RAA, `ativo`, fecho e auditoria. A operação idempotente mantém compatibilidade. Interface encaminha às operações oficiais. |

**Não foi criada uma nova autoridade de escrita.** `alunos.status` não deve ser preenchido com uma conclusão académica. As RPCs oficiais ainda detêm a autoridade para matrícula, progressão, fechamento e documentos.

Os novos testes `apps/web/tests/unit/student-lifecycle-ssot.spec.ts` cobrem pendência 2025 → 2026, snapshot aberto versus fechado, duplicidade, equivalência de legado, origens inconsistentes e consumo das rotas. Em réplica local isolada da branch, a execução de regressão de 28/10/2026 apresentou **500 testes aprovados, 4 ignorados, nenhuma falha**; validação de typecheck/CI é acompanhada separadamente, sem inferir homologação em produção.

**Pendências de aceitação:** homologação autenticada dos perfis/portais, validação de RLS do histórico para aluno e Secretaria, fechamento com snapshot oficial no ambiente apropriado, revisão escolar dos 300+250 legados e verificação completa do CI. Não aplicar updates em massa de `matriculas.status` ou `historico_anos.resultado_final` com base neste inventário.


## 7. Backend alinhado por migrações instaladas — 28/10/2026

**Esta secção atualiza o diagnóstico inicial e a secção 6.** O backend deixou de ser apenas um inventário e uma projeção TypeScript. Foram aplicadas **onze migrações** ao projeto Supabase KLASSE e cada SQL foi versionado nesta PR:

| Versão / migração aplicada | Finalidade |
|---|---|
| `20261028211345_lifecycle_p0_revoke_legacy_writers_20261028` | Revogar a `authenticated` e `anon` o EXECUTE de `confirmar_matricula`, `confirmar_matricula_core` e `finalizar_matricula_anual`. `service_role` permanece autorizado. |
| `20261028211433_lifecycle_sync_status_ativo_20261028` | Trigger `status → ativo`, `ativo NOT NULL`, CHECK validada; não há mais dois indicadores contraditórios persistíveis. |
| `20261028211533_lifecycle_history_ssot_view_20261028` | Compatibilidade de `resultado_final/status_final`, FK do histórico, origem obrigatória inicialmente `NOT VALID` e vista `security_invoker` com resultado oficial sujeito ao bloqueio legal. |
| `20261028211752_lifecycle_fix_historico_session_and_final_gate_20261028` | Corrige gerador anual para `matriculas.session_id` e exige matrícula finalizada/inativa antes de gerar histórico. |
| `20261028211809_lifecycle_finalizar_blindada_result_authority_20261028` | Encerramento `ativo=false` e escrita do resultado do GradeEngine no histórico quando há decisão calculada. |
| `20261028212124_lifecycle_reconcile_unique_historical_link_20261028` | Vinculou **1** histórico órfão com correspondência exata de escola, aluno, ano e turma; auditado, sem alterar resultado/snapshot. Validou CHECK de `matricula_id` obrigatório. |
| `20261028212242_lifecycle_matriculas_staff_write_rls_20261028` | Acrescentou políticas restritivas de INSERT/UPDATE/DELETE a operações autorizadas da secretaria/admin/polo, preservando isolamento de escola. |
| `20261028212343_lifecycle_ssot_view_private_scope_20261028` | Vista SSOT limitada a pessoal autorizado e ao próprio aluno. |
| `20261028212414_lifecycle_ssot_view_dba_scope_20261028` | Mantém a mesma proteção para utilizadores finais e permite a auditoria do PostgreSQL pelo DBA. |
| `20261028212425_lifecycle_aluno_activation_canonical_trigger_20261028` | Corrige a ativação administrativa do aluno para reconhecer `matriculas.status='ativo'` e validar escola, `ativo` e número. |

**Estado observado após aplicação:**
- **1.113** matrículas: **zero** divergências `status/ativo`, `ativo` nulo ou matrícula sem ano/sessão; vista SSOT produz `pendente/ativa/encerrada` corretamente.
- **14** históricos anuais: **zero** sem `matricula_id` (era 1), **zero** bloqueios legais, **zero** resultados oficialmente fechados. Os resultados registados **não** são promovidos silenciosamente a oficiais.
- **550** matrículas 2025 ainda `pendente` no Curtume: **300** com destino ativo 2026, **1** com destino vinculado não ativo, **249** sem destino vinculado. **Não reconciliar resultados sem fundamento académico da escola.**
- No ensaio sem sessão (`SET LOCAL ROLE authenticated`), a vista devolveu **zero matrículas**, como esperado.
- `supabase/ops/tests/regression_student_lifecycle_backend_ssot.sql` executou com sucesso no remoto; verifica CHECKs, FK, vista `security_invoker`, guarda do bloqueio legal, revogação das RPCs legadas e contrato GradeEngine.

**Integração HTTP com fonte de verdade única:**
- `load-student-lifecycle.ts` lê agora `v_student_lifecycle_ssot_v1` e o histórico pelo par `(escola_id, aluno_id)`. A aplicação interpreta o `resultado_oficial` decidido **pelo banco**, não pela flag de snapshot isolada.
- `POST /api/secretaria/rematricula/confirmar` fecha finalistas apenas por `finalizar_matricula_blindada` e devolve cada pendência, com recuperação no Balcão. Deixou de gravar `concluido` diretamente na turma inteira.
- `POST /api/secretaria/rematricula` deixa de oferecer o fallback seletivo inseguro que criava matrículas sem transação RAA e marcava origem como transferência. Sem RPC seletiva canónica, responde `409 LIFECYCLE_CANONICAL_RAA_REQUIRED` com orientação de recuperação.
- O portal de confirmação em massa mostra os finalistas efetivamente encerrados e bloqueios por turma, sem misturar com as promoções.

**O que ainda não está homologado como produto final:**
1. A máquina física `matriculas.status` ainda aceita códigos legados de resultado (`reprovado` etc.) para preservar RPCs antigas. A vista separa os significados, mas a migração final para quatro estados físicos e motivos de encerramento exige adaptação dos escritores RAA e testes de replay.
2. A regularização académica das 550 origens históricas depende de documento/decisão escolar. `pendente` não é aprovação nem reprovação; o destino ativo também não prova aprovação.
3. Fechamento e assinatura legal de históricos ainda não foram homologados de ponta a ponta (0 snapshots bloqueados). Testar num ambiente autorizado com turmas, notas, papel de operador e auditoria.
4. **Homologação autenticada** para secretaria, professor, aluno, polos e super-admin, incluindo privacidade da `security_invoker` view, RLS, funções `SECURITY DEFINER`, portal e transições financeiras.
5. Verificar o **replay completo** das migrações: as novas versões de 28/10 foram aplicadas em produção após migrações com identificadores cronologicamente posteriores no repositório. Uma recriação ordenada a partir do zero pode passar por escritores históricos antes de chegar ao estado atual; executar replay em réplica descartável e adicionar migração de estabilização final se necessário.
6. CI de todos os workflows da PR #282 precisa estar verde; só então permitir merge. Nenhum deploy Next.js foi efetuado nesta frente.

**Regra de proteção:** nunca fechar um histórico, conceder aprovação, alterar notas, emitir novo recibo ou criar obrigação financeira como efeito colateral de "conciliação de status".


## 8. Replay seguro e versão final de estabilização

As onze migrações realmente aplicadas em 28/10/2026 foram arquivadas em `supabase/ops/applied_lifecycle_20261028/`. Em `supabase/migrations` permanecem ficheiros de versão equivalente, sem efeitos no replay, pois algumas dependências só surgem nas migrações posteriores `202612` a `202710`. A estabilização determinística de todos os objetos é feita em `supabase/migrations/20271027120000_lifecycle_ssot_post_replay_guard.sql`, preservando a autoridade do GradeEngine, o SSOT com `security_invoker` e as restrições de escrita.

O contrato `node scripts/ci/lifecycle-migration-order.mjs` impede que futuras migrações passem silenciosamente depois da estabilização. O SQL de estabilização foi validado numa transação revertida no banco instalado; ainda falta replay completo numa instância descartável. O histórico de produção **não foi reparado nem eliminado**: todas as versões continuam registadas. O fecho dos 550 legados permanece dependente de evidência escolar.
