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
| BILL-006 | Facturação Electrónica AGT assíncrona | P0 | NEEDS WORK | PR #119; registarFactura/obterEstado/outbox/audit; RC ainda depende do BILL-007 |
| BILL-007 | Pagamentos, ledger, recibos e estornos | P0 | NEXT | necessário para paymentReceipt.sourceDocuments e RC |
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

**Estado:** NEEDS WORK  
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
- FT/FR/FG/GF/NC/ND mapeados fail-closed.

Gap restante:
- RC exige `paymentReceipt.sourceDocuments`;
- documentos RC actuais não possuem vínculo fiscal suficiente ao(s) documento(s) liquidado(s);
- dependência directa do BILL-007.

Critério para READY FOR HOMOLOGATION:
- BILL-007 fornecer sourceDocuments para RC;
- todos os tipos FE efectivamente usados pelo KLASSE possuírem mapper explícito ou bloqueio explícito.

Critério para CLOSED:
- `registarFactura` real -> `requestID`;
- `obterEstado` real -> V/I;
- reconciliação local confirmada;
- evidência de homologação armazenada.

---

## BILL-007 — Pagamentos, ledger, recibos e estornos

**Estado:** NEXT  
**Severidade:** P0

Objetivo:
modelar o pagamento como evento financeiro/fiscal rastreável, de modo que cada RC consiga provar exactamente quais documentos foram liquidados e em que montante.

Escopo mínimo:
- relação explícita `pagamento -> documento fiscal`;
- relação N:N `RC -> sourceDocuments`;
- pagamentos parciais;
- um pagamento liquidando múltiplas facturas;
- múltiplos pagamentos liquidando uma factura;
- impedir pagamento acima do saldo sem regra explícita;
- idempotência forte em validação/webhooks;
- concorrência: duas validações simultâneas do mesmo pagamento;
- estorno/reversão sem apagar histórico;
- remover dependência de cascades destrutivos em ledger/estornos;
- definir tratamento fiscal da reversão: NC/anulação/outro conforme o caso;
- ledger append-only;
- saldo derivável/reconciliável;
- mapper AGT de `paymentReceipt.sourceDocuments`;
- testes de consistência `pagamentos x mensalidades x ledger x fiscal_documentos`.

Critério para CLOSED:
- RC completo e rastreável;
- todos os cenários acima cobertos por constraints/RPCs/testes;
- nenhuma mutação destrutiva do histórico financeiro.

---

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
- proibir regressões de estado.

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

`BILL-007 -> BILL-008 -> BILL-009 -> BILL-010 -> BILL-011 -> BILL-012 -> BILL-013 -> BILL-014`

BILL-005 e BILL-006 permanecem ligados ao BILL-013 para a evidência externa de homologação.
