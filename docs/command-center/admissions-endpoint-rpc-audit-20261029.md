# Inbox de Admissões — auditoria de endpoints e RPCs (29/10/2026)

**PR:** #299, branch `feat/admissions-workspace-ux-20261029`  
**Âmbito:** botões do Inbox, folha de conversão, API da Secretaria e **assinaturas efetivamente instaladas** no Supabase KLASSE. Consultas SQL estritamente de leitura; nenhum pagamento, matrícula ou histórico foi alterado na base de produção.

## Matriz de rastreabilidade

| Ação no Inbox | Endpoint chamado pelo frontend | RPC que o endpoint utiliza | Verificação |
|---|---|---|---|
| Guardar alterações | `POST /api/secretaria/admissoes/draft` | `admissao_upsert_draft` | Assinatura encontrada; impedir troca silenciosa de candidatura |
| Efetivar matrícula | `POST /api/secretaria/admissoes/draft` e `POST /api/secretaria/admissoes/convert` | `admissao_finalizar_matricula` | RPC instalada e parâmetros compatíveis: escola, candidatura, turma, pagamento, idempotência, observação, capacidade e motivo |
| Confirmar pagamento da matrícula | Dentro de `/convert` | `financeiro_registrar_pagamento_secretaria` ou `financeiro_registrar_pagamentos_secretaria_batch` | Assinaturas encontradas; métodos `cash`, `tpa`, `transfer` correspondem ao enum do banco |
| Emitir recibo | Dentro de `/convert` | `emitir_recibo_servicos` | RPC instalada com `p_pagamento_id`; a emissão é posterior ao pagamento |
| Aprovar candidatura | `POST /api/secretaria/admissoes/approve` | `admissao_approve` | Assinatura encontrada; **não aceita `lista_espera`** |
| Solicitar documentos | `POST /api/secretaria/admissoes/pendencias` | `admissao_marcar_pendencias_documentos` | Assinatura encontrada |
| Aceitar documentos reenviados | `POST /api/secretaria/admissoes/revisar-documentos` | `admissao_revisar_documentos_reenviados` | Assinatura encontrada; só aceita estado `documentos_reenviados` |
| Promover pré-candidatura | `POST /api/secretaria/admissoes/[id]/promover` | `admissao_promover_pre_candidatura` | Assinatura encontrada, chave de idempotência obrigatória |
| Rejeitar | `POST /api/secretaria/admissoes/reject` | `admissao_reject` | Assinatura encontrada; transições corrigidas no frontend |
| Arquivar | `POST /api/secretaria/admissoes/archive` | `admissao_archive` | Assinatura encontrada; transições corrigidas no frontend |
| Reabrir | `POST /api/secretaria/admissoes/reabrir` | `admissao_reabrir` ou `admissao_unsubmit` | Assinaturas encontradas; legado `arquivado` não é elegível para `admissao_reabrir` |
| Atender próximo, consultar documentos/histórico | Estado local do Inbox | Nenhuma RPC | Ações locais; não alteram candidatura |

### Caminho de «Efetivar matrícula»

1. `handleNextAction` encaminha `convert` para a folha `AdmissaoConversionSheet`.
2. `handleEfetivar` guarda os dados pela API `draft`.
3. Envia `candidatura_id`, `turma_id`, meios/comprovativo de pagamento e chave `Idempotency-Key` para `/convert`.
4. O endpoint autoriza escola/perfil e inspeciona a sincronização do ano do calendário antes da RPC.
5. `admissao_finalizar_matricula` executa a finalização da candidatura/matrícula, incluindo validação de vaga e possibilidade de override autorizada; a RPC de conversão já existe no banco.
6. O endpoint invoca uma das RPCs de **registo de pagamento**, depois tenta gerar comprovativo e recibo.
7. Só após resposta com `matricula_id` o frontend guarda `enrollmentResult` e comunica ao Inbox que o candidato foi matriculado.

## Divergências corrigidas nesta PR

- `lista_espera` era enviada à aprovação simples, mas `admissao_approve` não aceita o estado. Agora utiliza o fluxo de conversão com validação de capacidade da RPC canónica.
- Botões secundários de rejeitar, arquivar, aprovar e reabrir apareciam para estados que o banco recusa. As condições de exibição agora refletem os estados permitidos.
- O endpoint `draft` podia voltar a executar `admissao_upsert_draft` sem o ID quando o registo existente não era encontrado, criando outra candidatura silenciosamente. Removido, com verificação explícita do ID.
- O endpoint `convert` devolvia o registo já matriculado **antes** de verificar autenticação e autorização. A ordem agora é autorização → verificação de estado/replay.
- A recuperação por idempotência passa a recusar reutilização da chave para candidatura ou turma diferente, e a recuperação de matrícula concluída verifica a turma associada.

## Bloqueio remanescente para certificar o fluxo como integralmente recuperável

**A finalização académica e a contabilização financeira ainda não são uma única transação.** A RPC `admissao_finalizar_matricula` pode concluir a candidatura/matrícula numa transação e o endpoint executa a RPC financeira noutra chamada. Se ocorrer falha entre ambas, uma tentativa posterior pode encontrar a candidatura `matriculado` ou uma chave de idempotência académica já gravada e devolver apenas o estado académico, **sem retomar o registo financeiro**.

A existência dos endpoints/RPCs corretos **não** certifica a recuperação da operação composta. Antes de produção é necessário proteger a fase financeira com um mecanismo persistente de retoma e reconciliação por matrícula/pagamento/chave, sem refazer pagamentos ou alterar o ledger fiscal. Não mudar a lógica financeira instalada nem presumir liquidação quando só a matrícula está concluída.

## Validação

- Testes de contrato: `apps/web/tests/unit/admissions-endpoint-rpc-contract.spec.ts`.
- Testes das 14 próximas ações: `apps/web/tests/unit/admissions-next-step.spec.ts`.
- Testes existentes: `apps/web/tests/unit/admissions-workspace-integration.spec.ts`.
- Workflow `Balcao Performance Budgets` passa a executar os três ficheiros.
- **Homologação pendente:** CI/typecheck e execução autenticada no Balcão com validação de status, matrícula, pagamento e recibo após refresh, retry e falha injetada.

**Veredicto:** os caminhos para os endpoints e as assinaturas RPC conferem; erros concretos de encaminhamento, permissão e identidade foram corrigidos nesta branch. Ainda não há certificação de execução end-to-end ou de recuperação financeira.
