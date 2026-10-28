# SSOT do ciclo de vida do aluno — conciliação transversal (PR #282)

**Data da auditoria:** 2026-10-28  
**Âmbito:** todas as escolas, todos os alunos e todos os anos (não apenas 2026/2027).  
**Estado:** inventário de leitura verificado no banco remoto; **nenhuma alteração de dados autorizada ou executada**.  
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
