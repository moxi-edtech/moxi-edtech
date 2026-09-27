# Backlog Canónico — Certificação Fiscal AGT

Data de referência: 2026-09-27  
Estado global: **NO-GO PARA CERTIFICAÇÃO / HOMOLOGAÇÃO AINDA EM CURSO**

Este documento é a fonte de verdade do backlog técnico de certificação fiscal do KLASSE.

## Regra de manutenção

Sempre que um `BILL-xxx` for alterado, fechado ou reaberto:

1. actualizar este documento no mesmo PR;
2. actualizar o estado e a evidência;
3. registrar dependências descobertas;
4. criar os próximos `BILL-xxx` antes de encerrar o bloco;
5. nunca marcar `CLOSED` apenas porque o código existe — quando houver dependência AGT externa, exigir evidência de homologação.

Estados usados:

- `CLOSED`: implementação + verificações internas concluídas, sem gap conhecido dentro do escopo.
- `READY FOR HOMOLOGATION`: código/DB prontos, falta prova contra AGT real/sandbox.
- `NEEDS WORK`: há implementação parcial e gaps conhecidos.
- `BLOCKED`: existe dependência externa ou de outro BILL que impede conclusão.
- `BACKLOG`: ainda não iniciado.

---

## Estado consolidado

| BILL | Área | Severidade | Estado | Evidência principal |
|---|---|---:|---|---|
| BILL-001 | Imutabilidade de documentos fiscais | P0 | CLOSED | PR #118; migrations de hardening 20260927135510 / 20260927140841 / 20260927141627 |
| BILL-002 | Imutabilidade de linhas e eventos fiscais | P0 | CLOSED | PR #118; append-only e remoção de grants de mutação |
| BILL-003 | Numeração/séries e reserva atómica | P0 | CLOSED | PR #118; reserva interna, sem EXECUTE directo; série AGT exigida no DB |
| BILL-004 | Contrato único de emissão e assinatura | P0 | CLOSED | PR #118; 1 overload; pendente_assinatura obrigatório; finalização backend-only |
| BILL-005 | Provisionamento de séries pela AGT | P0 | READY FOR HOMOLOGATION | PR #118; solicitarSerie schema 2.0; JWS/KMS; sem série AGT real ainda |
| BILL-006 | Facturação Electrónica AGT assíncrona | P0 | READY FOR HOMOLOGATION | PR #119 + BILL-007; registarFactura/obterEstado/outbox/audit; RC/paymentReceipt implementado |
| BILL-007 | Pagamentos, ledger, recibos e estornos | P0 | CLOSED | branch `fix/bill-007-payments-ledger-receipts`; alocações append-only, RC/sourceDocuments, N:N, reversão idempotente |
| BILL-008 | SAF-T(AO) semântico e contabilístico | P1 | BACKLOG | validar cobertura integral, não apenas XSD |
| BILL-009 | Motor fiscal/IVA e arredondamentos | P1 | BACKLOG | taxas, isenções, descontos, FX, retenções quando aplicáveis |
| BILL-010 | Ciclo de vida completo dos documentos | P1 | BACKLOG | rectificação, rejeição AGT, contingência, referências e tipos não-fiscais |
| BILL-011 | Segurança multi-tenant e least privilege fiscal | P1 | BACKLOG | RLS/grants/service-role/storage/cross-tenant |
| BILL-012 | Observabilidade, retries e recuperação fiscal | P2 | BACKLOG | DLQ, reconciliação, métricas, alertas, replay seguro |
| BILL-013 | Test pack de homologação AGT | P0 | BACKLOG | oracle tests reais, evidências request/response, V/I |
| BILL-014 | Governance/legal/go-live | P1/P2 | BACKLOG | retenção, políticas, dossiê e procedimento administrativo AGT |

---

## BILL-001 — Imutabilidade de documentos fiscais

**Estado:** CLOSED  
**PR:** #118

Fechado com:
- remoção de INSERT/UPDATE/DELETE/TRUNCATE directos dos papéis de aplicação;
- trigger de defesa contra DELETE;
- documentos emitidos só podem sofrer transições explicitamente permitidas;
- novas colunas não escapam silenciosamente da política de imutabilidade.

---

## BILL-002 — Imutabilidade de linhas e eventos

**Estado:** CLOSED  
**PR:** #118

Fechado com:
- itens fiscais sem UPDATE/DELETE pela aplicação;
- eventos fiscais append-only;
- service_role sem mutação directa de documentos/itens/eventos;
- trilha fiscal não depende de FKs acidentais para proteção.

---

## BILL-003 — Numeração e séries

**Estado:** CLOSED  
**PR:** #118

Fechado com:
- reserva de número serializada/atómica;
- `fiscal_reservar_numero_serie` não executável directamente pelos papéis de aplicação;
- UPDATE/DELETE/TRUNCATE directo da série removido;
- emissão fiscal rejeita série não provisionada pela AGT no limite do banco.

---

## BILL-004 — Emissão e assinatura

**Estado:** CLOSED  
**PR:** #118

Fechado com:
- exactamente um overload de `fiscal_emitir_documento`;
- documento novo nasce obrigatoriamente como `pendente_assinatura`;
- assinatura finalizada somente por backend privilegiado;
- caller não pode fornecer assinatura arbitrária para criar documento já emitido.

---

## BILL-005 — Séries AGT

**Estado:** READY FOR HOMOLOGATION  
**PR:** #118

Implementado:
- `solicitarSerie` com `schemaVersion 2.0`;
- JWS RS256/KMS;
- `submissionUUID`;
- persistência de `seriesCode`, quantidade autorizada e limites;
- onboarding e reprocessamento exigem `agt_status='provisioned'`;
- emissão é fail-closed sem série AGT.

Critério para CLOSED:
- chamada real de homologação `solicitarSerie`;
- resposta AGT persistida;
- emissão de primeiro documento dentro da série real;
- evidência request/response arquivada.

Estado actual do projecto em 2026-09-27:
- séries AGT reais provisionadas: **0**.

---

## BILL-006 — Facturação Electrónica AGT

**Estado:** READY FOR HOMOLOGATION  
**PR:** #119

Implementado:
- cliente directo `registarFactura`;
- cliente directo `obterEstado`;
- `schemaVersion 2.0`;
- assinatura JWS RS256 de software/documento/request;
- Basic Auth apenas server-side;
- outbox durável:
  - `fiscal_agt_submissions`;
  - `fiscal_agt_submission_documentos`;
  - `fiscal_agt_submission_eventos`;
- criação automática do outbox quando documento suportado vira `emitido`;
- `requestID`, resultCode, V/I, erros e respostas persistidos;
- reconciliação periódica;
- histórico de transições append-only;
- FT/FR/FG/GF/NC/ND mapeados fail-closed;
- RC mapeado sem `lines`, com `paymentReceipt.sourceDocuments`;
- origem do RC deriva de alocações financeiras imutáveis criadas no BILL-007;
- tipos FE não utilizados pelo KLASSE permanecem explicitamente bloqueados, não inferidos.

O critério interno para READY FOR HOMOLOGATION foi atingido com o BILL-007.

Critério para CLOSED:
- `registarFactura` real -> `requestID`;
- `obterEstado` real -> V/I;
- reconciliação local confirmada;
- evidência de homologação armazenada.

---

## BILL-007 — Pagamentos, ledger, recibos e estornos

**Estado:** CLOSED  
**Severidade:** P0  
**PR:** #120  
**Branch:** `fix/bill-007-payments-ledger-receipts`

Fechado com:
- `financeiro_pagamento_alocacoes` append-only como fonte canónica da aplicação do pagamento;
- `financeiro_pagamento_reversoes` e `financeiro_estornos` append-only;
- ledger sem UPDATE/DELETE e FKs financeiras críticas em `ON DELETE RESTRICT`;
- pagamento não pode ser apagado; campos financeiros de pagamento/mensalidade só mudam pelos fluxos canónicos;
- validação repetida do mesmo pagamento é idempotente;
- pagamento acima do saldo é rejeitado atomicamente;
- pagamento parcial exige FT/ND emitida antes da liquidação;
- múltiplos pagamentos podem liquidar progressivamente a mesma FT/ND;
- `financeiro_alocar_pagamento_multiplas_mensalidades` suporta um pagamento liquidando múltiplas facturas, com soma exacta, locks determinísticos e idempotência;
- RC deriva exclusivamente das alocações activas;
- `financeiro_recibo_alocacoes` liga RC -> alocação -> documento fiscal origem;
- RC não possui `lines`; usa `paymentReceipt.sourceDocuments`;
- soma regularizada nunca pode ultrapassar o remanescente fiscal da FT/ND;
- reversão financeira gera alocação inversa/estorno sem apagar histórico;
- se o pagamento já possui FR/RC fiscal, a reversão financeira fica bloqueada até o documento ser formalmente anulado/corrigido no BILL-010;
- `pagamento_intents` liquidados são materializados idempotentemente em `pagamentos`;
- RPCs legados `emitir_recibo*` que escreviam em `documentos_emitidos` perderam EXECUTE;
- trigger legado de recibo de rematrícula foi removido;
- rotas de recibo/balcão/outbox usam `fiscal_documentos` como fonte fiscal única;

Evidência transaccional rollback-only:
1. validação duplicada: `0 -> 2000 -> 2000`, uma única alocação;
2. overpayment: 2500 contra saldo 2000 rejeitado com pagamento/mensalidade/alocações intactos;
3. reversão: 1 aplicação + 1 reversão + 1 estorno + ledger liquidado/voided; segunda chamada idempotente;
4. parcial sem FT/ND: bloqueado antes da liquidação, sem alteração de saldo;
5. intent settled: 1 pagamento canónico, 0 recibos legacy, 1 evento de outbox fiscal;
6. RC multi-source: 2 `sourceDocuments`, 2 vínculos append-only, 0 lines, totais 34200/30000/4200, segunda emissão idempotente;
7. N:N: pagamento 2000 dividido 1000/1000 em duas mensalidades; exactamente 2 alocações e retry idempotente.

Testes de mapper:
- RC válido não contém `lines`;
- RC rejeita lines;
- RC rejeita sequência inválida de `sourceDocuments`.

Limite intencional:
- a **semântica fiscal da reversão** (anulação/NC/RE conforme caso e estado AGT) é escopo do BILL-010. O BILL-007 não permite divergência: ele bloqueia a reversão financeira enquanto o documento fiscal associado não estiver anulado.

## BILL-008 — SAF-T(AO) semântico e contabilístico

**Estado:** BACKLOG  
**Severidade:** P1

Escopo:
- confirmar cobertura do SAF-T(AO) actual além de passar no XSD;
- Header;
- MasterFiles;
- SourceDocuments;
- SalesInvoices;
- Payments;
- WorkingDocuments quando aplicável;
- GeneralLedgerEntries quando exigido pelo regime/obrigação aplicável;
- reconciliação de totais entre SAF-T e banco;
- fixtures oficiais;
- validar códigos/tipos contra legislação e docs AGT actuais;
- arquivo de evidência XSD + semântica.

---

## BILL-009 — Motor fiscal / IVA

**Estado:** BACKLOG  
**Severidade:** P1

Escopo:
- tabela de taxas/códigos fiscais versionada;
- IVA normal/intermédio/reduzido/isento quando aplicável;
- códigos e motivos de isenção;
- descontos de linha/global e settlement;
- arredondamento conforme contrato AGT;
- moeda estrangeira e taxa de câmbio;
- retenções/impostos adicionais quando aplicáveis;
- impedir combinações inválidas `taxCode x rate`;
- testes oracle por cenário fiscal.

---

## BILL-010 — Ciclo de vida documental

**Estado:** BACKLOG  
**Severidade:** P1

Escopo:
- NC/ND e referências obrigatórias;
- documento rejeitado pela AGT e reemissão/correcção;
- anulação;
- contingência;
- documentos recuperados/manual;
- tratamento de proforma e documentos não fiscais;
- tipos de documento permitidos por contexto;
- regras de passagem de estado;
- proibir regressões de estado;
- implementar o caminho fiscal que desbloqueia reversões financeiras de pagamentos já fiscalizados;
- investigar/corrigir documentos históricos com `tipo_documento='FT'` mas `numero_formatado` no padrão `FR-...`, encontrados durante os testes BILL-007.

---

## BILL-011 — Segurança fiscal multi-tenant

**Estado:** BACKLOG  
**Severidade:** P1

Escopo:
- auditoria completa de RLS dos objetos financeiro/fiscal;
- grants de `anon`, `authenticated`, `service_role`;
- SECURITY DEFINER e EXECUTE;
- isolamento empresa/escola;
- storage fiscal e URLs assinadas;
- referências de KMS sem exposição indevida;
- testes cross-tenant positivos e negativos;
- revisar tabelas financeiras legadas ainda com grants amplos.

---

## BILL-012 — Observabilidade e recuperação

**Estado:** BACKLOG  
**Severidade:** P2

Escopo:
- métricas de submissão AGT;
- fila de pendências;
- DLQ/retry/replay seguro;
- alertas para `uncertain`, `mapping_error`, rejeições e backlog;
- SLA operacional;
- correlação request local / submissionUUID / requestID AGT;
- reconciliação automática e manual;
- proteção contra replay duplicado.

---

## BILL-013 — Homologação e testes AGT

**Estado:** BACKLOG  
**Severidade:** P0

Escopo:
- suite executable de homologação;
- série AGT real;
- FT padrão;
- FR;
- isenção;
- NC;
- ND;
- RC;
- moeda estrangeira quando aplicável;
- consumidor final;
- rejeição intencional;
- duplicate submission;
- timeout/uncertain;
- `obterEstado` V/I;
- captura sanitizada de requests/responses;
- matriz resultado esperado x resultado AGT.

---

## BILL-014 — Governance e go-live

**Estado:** BACKLOG

Escopo:
- política de retenção fiscal;
- rotação/versionamento de chaves;
- acessos administrativos;
- backup/restauração;
- dossiê final;
- procedimento operacional;
- comprovativos e processo administrativo AGT;
- checklist final GO/NO-GO.

---

## Ordem actual de execução

`BILL-008 -> BILL-009 -> BILL-010 -> BILL-011 -> BILL-012 -> BILL-013 -> BILL-014`

BILL-005 e BILL-006 permanecem ligados ao BILL-013 exclusivamente para evidência externa de homologação AGT.
