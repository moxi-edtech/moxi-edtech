# Handoff — Backlogs Fiscais KLASSE / Certificação AGT

Data de referência: 2026-09-27

Repo: `moxi-edtech/moxi-edtech`  
Branch de continuação: `fix/bill-008-saft-semantic-accounting`  
Backlog canónico: `docs/fiscal/certificacao/backlog-certificacao-agt.md`

Este documento é o ponto de retomada operacional para qualquer agente que continue a auditoria e implementação fiscal do KLASSE a partir do BILL-009.

## 1. Regra de fonte e método

A ordem de autoridade usada até aqui deve ser preservada:

1. documentação oficial AGT / Portal do Parceiro e XSD SAF-T(AO);
2. comportamento real do banco Supabase, migrations e código do KLASSE;
3. testes executáveis, CI e evidência rollback-only;
4. implementações open source apenas como referência secundária, nunca como fonte normativa.

Um BILL não deve ser fechado por inferência, por existência de código ou porque um teste isolado passou. O fechamento exige evidência rastreável no escopo certo.

## 2. Estado real do stack de PRs

Os trabalhos fiscais estão empilhados e ainda não estão todos mergeados em `main`.

Ordem obrigatória do stack:

`PR #118 -> PR #119 -> PR #120 -> PR #121`

- PR #118 — BILL-001 a BILL-005 — base `main`;
- PR #119 — BILL-006 — base PR #118;
- PR #120 — BILL-007 — base PR #119;
- PR #121 — BILL-008 — base PR #120.

Consequência operacional: enquanto esse stack estiver aberto, o próximo agente **não deve iniciar BILL-009 a partir de `main`**. Deve partir do head de `fix/bill-008-saft-semantic-accounting` ou do sucessor já mergeado que contenha integralmente #118-#121.

Importante: o Supabase live já contém migrations desse stack, inclusive todas as seis migrations do BILL-008. Portanto existe risco real de drift código <-> DB se o stack for descartado, reordenado ou recriado a partir de `main`.

Os estados `CLOSED` abaixo significam "gap interno do BILL fechado no stack atual". Não significam que o PR já foi mergeado em `main`.

## 3. Estado consolidado BILL-001 a BILL-008

| BILL | Estado | O que foi fechado | Evidência / limite |
|---|---|---|---|
| BILL-001 | CLOSED | Imutabilidade de documentos fiscais | PR #118; grants directos removidos; guards de DELETE/mutação |
| BILL-002 | CLOSED | Linhas e eventos fiscais append-only | PR #118; sem UPDATE/DELETE directo em itens/eventos |
| BILL-003 | CLOSED | Numeração/séries atómicas | PR #118; reserva serializada; emissão exige série AGT |
| BILL-004 | CLOSED | Contrato único de emissão/assinatura | PR #118; um overload; nasce `pendente_assinatura`; finalização backend-only |
| BILL-005 | READY FOR HOMOLOGATION | Provisionamento de séries AGT | PR #118; `solicitarSerie`, JWS/KMS, ledger; falta série AGT real |
| BILL-006 | READY FOR HOMOLOGATION | Facturação Electrónica AGT assíncrona | PR #119; outbox, `registarFactura`, `obterEstado`, V/I; falta prova AGT real |
| BILL-007 | CLOSED | Pagamentos, ledger, RC e estornos internos | PR #120; alocações append-only, N:N, RC/sourceDocuments, reversão fail-closed |
| BILL-008 | READY FOR HOMOLOGATION | SAF-T(AO) Facturação F semântico + XSD + hash próprio | PR #121; 21/21 testes fiscais; falta validação externa AGT |

## 4. BILL-001 — Imutabilidade de documentos fiscais

Fechado no PR #118.

Garantias estabelecidas:

- `anon` e `authenticated` não possuem INSERT/UPDATE/DELETE/TRUNCATE directo em documentos fiscais;
- `service_role` não pode mutar/truncar documentos fiscais directamente;
- DELETE possui defesa adicional por trigger/guard;
- mutações de documentos emitidos são permitidas apenas por transições explicitamente autorizadas;
- a política é allowlist: coluna nova não fica mutável por acidente.

Não quebrar isto para "facilitar" BILL-009+.

## 5. BILL-002 — Linhas e eventos fiscais

Fechado no PR #118.

Garantias:

- itens fiscais são append-only;
- eventos fiscais são append-only;
- INSERT directo de evento pelos papéis de aplicação foi removido;
- service role não recebe mutação directa irrestrita de documentos/itens/eventos;
- trilha fiscal não depende de FK acidental como mecanismo de proteção.

Qualquer correção futura deve criar fluxo canónico/evento, não editar história.

## 6. BILL-003 — Numeração e séries

Fechado no PR #118.

Garantias:

- reserva de número é atómica/serializada;
- `fiscal_reservar_numero_serie` não é RPC de uso directo pela aplicação;
- série não pode ser UPDATE/DELETE/TRUNCATE directamente pelos papéis de aplicação;
- emissão fiscal falha fechada se a série não estiver provisionada pela AGT;
- limites autorizados pela série AGT são respeitados.

Nunca gerar número fiscal no frontend, em memória, por `max(numero)+1` ou por fallback local.

## 7. BILL-004 — Emissão e assinatura

Fechado no PR #118.

Garantias:

- existe um único contrato autoritativo de `fiscal_emitir_documento`;
- documento novo nasce `pendente_assinatura`;
- caller não injeta assinatura arbitrária;
- finalização é backend-only;
- assinatura e transição para emitido reutilizam o fluxo fiscal canónico.

Não criar overload novo para resolver incompatibilidade de caller. Corrigir o caller.

## 8. BILL-005 — Séries AGT

Estado: **READY FOR HOMOLOGATION**.

Implementado no PR #118:

- `solicitarSerie` com schema 2.0;
- `submissionUUID`;
- JWS RS256 via KMS;
- persistência de `seriesCode`, quantidade autorizada e limites;
- ledger durável para evitar reenvio cego após outcome incerto;
- onboarding/reprocessamento exigem `agt_status='provisioned'`;
- emissão falha fechada sem série AGT.

Falta para `CLOSED`:

- chamada real no ambiente de homologação AGT;
- resposta persistida;
- primeira emissão usando série AGT real;
- request/response sanitizados arquivados.

Snapshot live validado em 2026-09-27: **0 séries com `agt_status='provisioned'`**.

## 9. BILL-006 — Facturação Electrónica AGT

Estado: **READY FOR HOMOLOGATION**.

Implementado no PR #119:

- clientes directos `registarFactura` e `obterEstado`;
- schema 2.0;
- Basic Auth somente server-side;
- JWS RS256 via KMS;
- identidade de submissão estável;
- outbox durável:
  - `fiscal_agt_submissions`;
  - `fiscal_agt_submission_documentos`;
  - `fiscal_agt_submission_eventos`;
- criação automática do outbox ao emitir documento suportado;
- persistência de `requestID`, resultCode, V/I, erros e respostas;
- reconciler para estados prepared/submitted/processing/uncertain;
- FT/FR/FG/GF/NC/ND mapeados fail-closed;
- RC integrado depois do BILL-007.

Invariável crítica: um outcome `uncertain` **não cria nova identidade de submissão**. Reconcile/poll com a mesma identidade.

Falta para `CLOSED`:

- `registarFactura` real retornando `requestID`;
- `obterEstado` real retornando V/I;
- reconciliação persistida;
- evidência externa arquivada.

Snapshot live validado em 2026-09-27: **0 submissions com `request_id` real**.

## 10. BILL-007 — Pagamentos, ledger, recibos e estornos

Estado: **CLOSED** no escopo interno.

Fechado no PR #120 com:

- `financeiro_pagamento_alocacoes` append-only como fonte canónica da aplicação de pagamentos;
- `financeiro_pagamento_reversoes` append-only;
- `financeiro_recibo_alocacoes` append-only;
- ledger/estornos sem mutação directa;
- FKs financeiras críticas em `ON DELETE RESTRICT`;
- validação idempotente;
- overpayment bloqueado atomicamente;
- pagamento parcial exige FT/ND origem;
- um pagamento pode liquidar múltiplas mensalidades/facturas;
- múltiplos pagamentos podem liquidar progressivamente a mesma FT/ND;
- RC é derivado exclusivamente das alocações activas;
- RC possui zero `lines`;
- RC usa `paymentReceipt.sourceDocuments`;
- vínculos RC -> alocação -> documento fiscal origem persistidos;
- RPCs legados de recibo que escreviam em `documentos_emitidos` perderam EXECUTE;
- trigger legado de recibo de rematrícula removido;
- rotas fiscais usam `fiscal_documentos` como SSOT.

Regra de reversão: se o pagamento já possui FR/RC fiscal associado, a reversão financeira fica bloqueada até existir correção/anulação fiscal formal. Essa semântica pertence ao BILL-010.

Evidência rollback-only do PR #120 cobre idempotência, overpayment, reversão, parcial sem FT/ND, intent settled, RC multi-source, N:N e comprovativo parcial sem resíduos.

## 11. BILL-008 — SAF-T(AO) semântico e contabilístico

Estado real: **READY FOR HOMOLOGATION**, não CLOSED.

PR #121.

Limite funcional deliberado:

- KLASSE suporta SAF-T de **Facturação**: `TaxAccountingBasis=F`;
- KLASSE não declara SAF-T contabilístico `C/I`, porque o ledger financeiro operacional não é razão de dupla entrada com plano de contas;
- `C/I` deve continuar fail-closed até existir módulo contabilístico real ou integração adequada.

Implementado:

- Header completo com identidade do produtor, versão e software validation number;
- configuração do Header congelada no pedido e reutilizada pelo worker;
- MasterFiles Customer, Product e TaxTable;
- ProductType P/S/O/E/I;
- unidade de medida e perfil fiscal preservados;
- consumidor final canónico;
- TaxTable derivada dos perfis fiscais usados;
- SalesInvoices com débito/crédito sobre valor líquido;
- polaridade explícita de documentos;
- `TotalDebit/TotalCredit` reconciliados;
- anulados mantidos com timestamp/motivo/actor, mas fora dos control totals;
- WorkingDocuments;
- MovementOfGoods e `TotalQuantityIssued`;
- Payments/RC a partir de `paymentReceipt.sourceDocuments`;
- RC sem linhas artificiais;
- IVA 0 exige código `Mxx` + motivo;
- `NetTotal + TaxPayable = GrossTotal`;
- FX exige taxa positiva;
- UnitPrice/SettlementAmount exportados/reconciliados em AOA;
- SourceDocuments ordenados;
- número fiscal é preservado exactamente; exportador não re-numera legado;
- tipo sem mapeamento falha fechado;
- XML validado contra XSD SAF-T(AO) 1.01_01;
- exportação `validated` é imutável e não apagável.

### 11.1 Hash SAF-T é separado da assinatura FE

Não unificar estas duas cadeias:

- Facturação Electrónica: RSA-2048 / JWS RS256;
- SAF-T validado: cadeia separada RSA-1024 / SHA-1 conforme contrato implementado;
- software ainda não validado exporta `Hash=0` e `HashControl=0`;
- software validado exige `saft_hash`, `saft_hash_control`, `saft_hash_anterior`, `saft_canonical_string` e `saft_required`;
- ativação de cadeia SAF-T validada exige **nova série**; não inicia no meio de série histórica;
- RC pertence a Payments e não entra nessa cadeia porque o XSD de Payments não possui Hash/HashControl.

### 11.2 Migrations BILL-008 já aplicadas no Supabase

Confirmadas no histórico live:

- `20260927171437_bill_008_saft_document_signature_chain.sql`
- `20260927171531_bill_008_saft_signature_rollout_compatibility.sql`
- `20260927172254_bill_008_saft_validated_series_boundary.sql`
- `20260927172749_bill_008_saft_export_evidence_immutability.sql`
- `20260927172931_bill_008_saft_invoice_identity_guard.sql`
- `20260927173123_bill_008_saft_hash_scope_guard.sql`

### 11.3 Evidência interna

PR #121 registra:

- 21 testes fiscais;
- 21 pass;
- 0 fail;
- série legacy rejeitada ao ativar cadeia validada;
- RC rejeitado como documento sujeito à cadeia de Hash;
- export `validated` rejeita UPDATE;
- export `validated` rejeita DELETE;
- zero resíduos dos testes rollback-only.

Spot-check live em 2026-09-27 confirmou:

- documentos emitidos/anulados/rectificados: **121**;
- divergências entre totais dos documentos e soma das linhas: **0**;
- linhas com IVA 0 sem código/motivo de isenção: **0**;
- RC emitidos históricos sem vínculo de origem em `financeiro_recibo_alocacoes`: **8**;
- séries AGT provisionadas: **0**;
- submissions AGT com `request_id`: **0**.

O snapshot de fechamento do BILL-008 documentou ainda **98 documentos comerciais históricos incompatíveis com a regra canónica usada pela auditoria**. Não substituir essa evidência por heurística ad-hoc de prefixo; a regra real do exporter valida o formato completo `<tipo> <serie>/<sequencial>`, tipo e contador persistido.

Esses históricos permanecem fail-closed. Não re-numerar, não editar documento emitido e não inventar `sourceDocuments`.

Falta para `CLOSED`:

- fixture representativa submetida ao validador/portal AGT;
- confirmação externa dos cenários FT/FR/NC/ND/RC;
- evidência arquivada no dossiê.

Isso pertence ao BILL-013.

## 12. Invariantes que BILL-009+ não pode quebrar

1. **Imutabilidade fiscal:** não habilitar mutação directa em documento, item ou evento para resolver backlog.
2. **SSOT:** `fiscal_documentos` permanece a fonte fiscal canónica; não reativar `documentos_emitidos` como SSOT.
3. **Numeração:** somente reserva atómica em série AGT provisionada.
4. **Assinatura:** documento nasce pendente; assinatura/finalização apenas no backend canónico.
5. **Idempotência AGT:** mesma submissão continua com a mesma identidade após retry/uncertain.
6. **RC:** zero linhas; origem vem de alocações financeiras append-only e vira `paymentReceipt.sourceDocuments`.
7. **Reversão:** não permitir divergência entre financeiro e fiscal; pagamentos fiscalizados exigem correção fiscal antes da reversão.
8. **Histórico:** não editar, renumerar ou fabricar origem para tornar SAF-T "bonito".
9. **SAF-T:** apenas `F` enquanto não existir razão contabilístico real.
10. **Hash:** não reutilizar assinatura FE como Hash SAF-T.
11. **Série validada:** cadeia SAF-T validada só começa numa série nova compatível.
12. **Multi-tenant:** não relaxar RLS/grants/SECURITY DEFINER como atalho. BILL-011 fará auditoria específica.
13. **Fail-closed:** tipo, taxa, código, estado ou referência desconhecidos devem bloquear o fluxo, não receber fallback silencioso.
14. **Evidência:** um status só muda no backlog quando a evidência correspondente existe.
15. **Stack:** não reconstruir BILL-009 sobre `main` enquanto #118-#121 não estiverem integrados.

## 13. Próximos BILLs

### BILL-009 — Motor fiscal / IVA

Estado inicial: BACKLOG.

Objetivo:

- tabela de taxas/códigos fiscais versionada;
- IVA normal/intermédio/reduzido/isento quando aplicável;
- códigos e motivos de isenção;
- descontos de linha/global e settlement;
- arredondamento conforme contrato AGT;
- FX e taxa de câmbio;
- retenções/impostos adicionais quando aplicáveis;
- impedir combinações inválidas `taxCode x rate`;
- oracle tests por cenário.

O agente deve começar auditando o que já existe no DB, mapper FE, mapper SAF-T e schemas antes de criar tabela/enum novo. Não duplicar tax metadata já persistida nos itens do BILL-008.

### BILL-010 — Ciclo de vida documental

Estado inicial: BACKLOG.

Objetivo:

- NC/ND e referências obrigatórias;
- rejeição AGT e correção/reemissão;
- anulação;
- contingência;
- documentos recuperados/manual;
- proforma e documentos não fiscais;
- tipos permitidos por contexto;
- state machine sem regressões;
- caminho fiscal que desbloqueia reversões financeiras;
- tratar históricos incompatíveis sem mutar silenciosamente documentos emitidos.

Este BILL é o local correto para os históricos de numeração e RC sem origem; não "corrigir" esses dados dentro do exporter.

### BILL-011 — Segurança fiscal multi-tenant

Estado inicial: BACKLOG.

Auditar:

- RLS de todos os objetos fiscal/financeiro;
- grants `anon`, `authenticated`, `service_role`;
- SECURITY DEFINER / EXECUTE / ownership;
- isolamento empresa/escola;
- storage fiscal e URLs;
- KMS references;
- testes cross-tenant positivos e negativos;
- tabelas financeiras legadas com grants amplos.

### BILL-012 — Observabilidade e recuperação

Estado inicial: BACKLOG.

Implementar/provar:

- métricas de submissão;
- fila de pendências;
- DLQ;
- retry/replay seguro;
- alertas para uncertain/mapping_error/rejeições;
- SLA;
- correlação local/submissionUUID/requestID;
- reconciliação automática/manual;
- proteção contra replay duplicado.

### BILL-013 — Homologação e testes AGT

Estado inicial: BACKLOG e dependência externa.

Este BILL carrega a prova externa que ainda impede `CLOSED` em BILL-005, BILL-006 e BILL-008.

Test pack mínimo:

- série AGT real;
- FT;
- FR;
- isenção;
- NC;
- ND;
- RC;
- FX quando aplicável;
- consumidor final;
- rejeição intencional;
- duplicate submission;
- timeout/uncertain;
- `obterEstado` V/I;
- SAF-T representativo;
- requests/responses sanitizados;
- matriz esperado x recebido.

Não marcar 005/006/008 CLOSED antes dessa evidência.

### BILL-014 — Governance e go-live

Estado inicial: BACKLOG.

Cobrir:

- retenção fiscal;
- rotação/versionamento de chaves;
- acessos administrativos;
- backup/restauração;
- dossiê final;
- procedimento operacional;
- processo administrativo AGT;
- checklist final GO/NO-GO.

## 14. Protocolo obrigatório para fechar cada BILL

Todo fechamento deve deixar, no mínimo:

1. **Escopo** — requisito e gap exactos.
2. **Fonte normativa** — URL/doc AGT/XSD usado.
3. **Repo** — branch, PR, commit e arquivos alterados.
4. **DB** — migrations versionadas e confirmação no histórico aplicado.
5. **Teste positivo** — cenário esperado.
6. **Teste negativo** — cenário que deve falhar fechado.
7. **Idempotência/race** — quando o fluxo puder ser repetido ou concorrer.
8. **Segurança** — grants/RLS/advisors quando tocar DB/auth/storage.
9. **Regressão** — suite relevante no CI.
10. **Resíduo** — confirmar que rollback tests não deixaram dados.
11. **Evidência externa** — obrigatória quando o critério depende da AGT.
12. **Documentação** — atualizar `backlog-certificacao-agt.md` e este handoff no mesmo PR.

Se qualquer item aplicável estiver sem prova, usar `NEEDS WORK`, `BLOCKED` ou `READY FOR HOMOLOGATION`; não usar `CLOSED`.

## 15. Padrões proibidos

O próximo agente não deve:

- copiar implementação open source e tratá-la como requisito AGT;
- alterar histórico fiscal para fazer um teste passar;
- criar fallback silencioso para tipo/taxa/código desconhecido;
- gerar nova série ou número fora do fluxo AGT/canónico;
- reenviar operação incerta com nova identidade;
- colocar credencial AGT/KMS no cliente;
- dar EXECUTE público a SECURITY DEFINER para resolver erro de permissão;
- usar `service_role` como substituto de autorização;
- produzir SAF-T C/I sem razão contabilístico real;
- reintroduzir recibo fiscal legado fora de `fiscal_documentos`;
- fechar backlog externo sem evidência externa.

## 16. Ponto exacto de retomada

A próxima implementação é:

`BILL-009 — Motor fiscal / IVA`

Ordem prevista:

`BILL-009 -> BILL-010 -> BILL-011 -> BILL-012 -> BILL-013 -> BILL-014`

Antes de escrever código no BILL-009:

1. partir do stack que contém #118-#121;
2. ler o backlog canónico e este handoff;
3. inventariar tax metadata já existente em `fiscal_documentos`, `fiscal_documento_itens`, mapper FE e SAF-T;
4. comparar com a documentação AGT actual;
5. registrar gaps com evidência;
6. implementar apenas o delta necessário;
7. provar no DB + testes;
8. atualizar os dois documentos no mesmo PR.
