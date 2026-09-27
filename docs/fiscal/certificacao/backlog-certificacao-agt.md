# Backlog Canónico — Certificação Fiscal AGT

Data de referência: 2026-09-27  
Estado global: **NO-GO PARA CERTIFICAÇÃO / HOMOLOGAÇÃO AINDA EM CURSO**

Este documento é a fonte de verdade do backlog técnico de certificação fiscal do KLASSE.


## Handoff operacional

Ponto de retomada para outro agente:

- `docs/fiscal/certificacao/handoff-backlogs-fiscais.md`
- branch actual: `fix/bill-008-saft-semantic-accounting`
- stack aberto: `PR #118 -> #119 -> #120 -> #121`
- próximo BILL: `BILL-009 — Motor fiscal / IVA`

Enquanto #118-#121 não estiverem integrados em `main`, o BILL-009 deve partir deste stack, não de `main`. As migrations do stack já estão aplicadas no Supabase live; descartar/reordenar o stack cria drift código <-> DB.

`CLOSED` neste documento significa que o gap interno do BILL foi fechado e provado no stack correspondente; não significa, por si só, que o PR já foi mergeado em `main`.


## Regra de manutenção

Sempre que um `BILL-xxx` for alterado, fechado ou reaberto:

1. actualizar este documento no mesmo PR;
2. actualizar o estado e a evidência;
3. registrar dependências descobertas;
4. criar os próximos `BILL-xxx` antes de encerrar o bloco;
5. nunca marcar `CLOSED` apenas porque o código existe — quando houver dependência AGT externa, exigir evidência de homologação.
6. actualizar também `handoff-backlogs-fiscais.md` no mesmo PR, preservando invariantes, dependências, evidência e ponto de retomada.

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
| BILL-008 | SAF-T(AO) semântico e contabilístico | P1 | READY FOR HOMOLOGATION | SAF-T Facturação F semântico + XSD + hash dedicado; dados históricos incompatíveis fail-closed |
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
- comprovativo parcial do portal do aluno falha cedo quando não existe FT/ND origem, evitando pagamento pendente impossível de validar;
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
7. N:N: pagamento 2000 dividido 1000/1000 em duas mensalidades; exactamente 2 alocações e retry idempotente;
8. comprovativo parcial do aluno sem FT/ND: rejeitado antes de criar pagamento pendente; zero resíduos.

Testes de mapper:
- RC válido não contém `lines`;
- RC rejeita lines;
- RC rejeita sequência inválida de `sourceDocuments`.

Limite intencional:
- a **semântica fiscal da reversão** (anulação/NC/RE conforme caso e estado AGT) é escopo do BILL-010. O BILL-007 não permite divergência: ele bloqueia a reversão financeira enquanto o documento fiscal associado não estiver anulado.

## BILL-008 — SAF-T(AO) semântico e contabilístico

**Estado:** READY FOR HOMOLOGATION  
**Severidade:** P1  
**PR:** #121

Implementado:

- contrato explícito de **SAF-T de Facturação (`TaxAccountingBasis=F`)**;
- `C/I` é fail-closed porque o KLASSE não mantém plano de contas + razão de dupla entrada; não é gerado um SAF-T contabilístico falso;
- Header com identidade do produtor, versão do produto e número de validação;
- configuração do Header congelada no pedido e reutilizada pelo worker para reprodutibilidade;
- `MasterFiles.Customer`, `Product` e `TaxTable`;
- ProductType P/S/O/E/I, unidade de medida e perfil fiscal explícito preservados do documento;
- consumidor final canónico;
- TaxTable derivada dos perfis fiscais efectivamente usados;
- SalesInvoices com `DebitAmount/CreditAmount` líquido, sem IVA;
- polaridade explícita para NC/RE vs documentos de crédito;
- `TotalDebit/TotalCredit` reconciliados com documentos normais;
- documentos anulados excluídos dos control totals e exportados com timestamp/motivo/actor real do evento;
- WorkingDocuments;
- MovementOfGoods e `TotalQuantityIssued` excluindo anulados;
- Payments/RC usando `paymentReceipt.sourceDocuments` do BILL-007;
- RC sem linhas fiscais artificiais;
- isenção IVA 0 exige `Mxx` + motivo;
- reconciliação `NetTotal + TaxPayable = GrossTotal`;
- moeda estrangeira exige taxa de câmbio positiva;
- UnitPrice/SettlementAmount são exportados em AOA e reconciliados com a linha fiscal original;
- SourceDocuments ordenados por tipo / série / número sequencial;
- número fiscal nunca é reescrito pelo exportador;
- tipos sem mapeamento são rejeitados;
- evidência de validação semântica persistida no metadata do export;
- XML validado contra o XSD AO 1.01_01 no worker e na regressão fiscal CI;
- exportação `validated` imutável e não apagável.

### Hash SAF-T vs Facturação Electrónica

A assinatura FE RSA-2048 não é reutilizada no campo SAF-T `Hash`:

- assinaturas FE actuais têm 344 caracteres Base64;
- o XSD SAF-T limita `Hash` a 172;
- software ainda não validado (`SoftwareValidationNumber=0`) exporta `Hash=0` e `HashControl=0`;
- software validado activa cadeia SAF-T separada RSA-1024/SHA1;
- `saft_hash`, `saft_hash_control`, `saft_hash_anterior`, `saft_canonical_string` e `saft_required` são persistidos;
- activação da cadeia validada exige **nova série**: não pode começar a meio de uma série histórica;
- RC pertence a `Payments` e não entra na cadeia de Hash/HashControl porque essa estrutura não possui esses campos no XSD.

### Evidência interna

Pré-validação do banco em 2026-09-27:

- documentos emitidos/anulados/rectificados avaliados: **121**;
- divergências entre totais dos documentos e soma das linhas: **0**;
- linhas IVA 0 sem código/motivo de isenção: **0**;
- documentos anulados sem evento/motivo: **0**;
- tipos sem mapeamento SAF-T: **0**;
- documentos comerciais históricos fora do formato canónico: **98**;
- RC históricos sem `paymentReceipt.sourceDocuments`: **8**.

Os dois últimos grupos são **dados históricos** e são recusados deliberadamente. O SAF-T não fabrica/re-numera documentos fiscais para os esconder.

Testes rollback-only:

1. exportação SAF-T `validated` não pode ser alterada;
2. exportação SAF-T `validated` não pode ser apagada;
3. cadeia SAF-T validada não pode começar numa série que já contém documento fora da cadeia.

Testes unitários/CI:

- modo não validado -> Hash/HashControl zero;
- modo validado exige hash dedicado de 172 caracteres;
- SalesInvoices líquido e polaridade;
- TaxTable e isenções;
- RC/sourceDocuments;
- reconciliação de totais;
- ordenação tipo/série/sequência;
- anulação com timestamp/motivo;
- número fiscal histórico não é reescrito;
- XML gerado validado no XSD oficial empacotado.

### Migrations

- `20260927171437_bill_008_saft_document_signature_chain.sql`
- `20260927171531_bill_008_saft_signature_rollout_compatibility.sql`
- `20260927172254_bill_008_saft_validated_series_boundary.sql`
- `20260927172749_bill_008_saft_export_evidence_immutability.sql`
- `20260927172931_bill_008_saft_invoice_identity_guard.sql`
- `20260927173123_bill_008_saft_hash_scope_guard.sql`

### Limite contabilístico

O KLASSE possui ledger financeiro operacional, mas isso **não equivale** a um razão contabilístico com plano de contas e partidas dobradas. Portanto:

- SAF-T Facturação: suportado;
- SAF-T Contabilidade `C/I`: não declarado como suportado;
- uma futura obrigação de SAF-T contabilístico para a própria entidade escolar exige módulo contabilístico real ou integração com sistema contabilístico.

### Dependências deliberadas

- os 98 documentos comerciais históricos com numeração não-canónica e os 8 RC históricos sem origem devem ser tratados no **BILL-010**, sem mutar silenciosamente documentos emitidos;
- expansão de códigos fiscais, descontos, retenções e combinações tributárias será revista no **BILL-009**;
- submissão/aceitação externa AGT permanece no **BILL-013**.

Critério para READY FOR HOMOLOGATION: **atingido internamente para SAF-T Facturação F**.

Critério para CLOSED:
- submissão de fixture representativa ao validador/portal AGT;
- confirmação externa dos cenários FT/FR/NC/ND/RC;
- evidência arquivada no dossiê.

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

`BILL-009 -> BILL-010 -> BILL-011 -> BILL-012 -> BILL-013 -> BILL-014`

BILL-005 e BILL-006 permanecem ligados ao BILL-013 exclusivamente para evidência externa de homologação AGT.
