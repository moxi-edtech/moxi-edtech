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
| BILL-008 | SAF-T(AO) semântico e contabilístico | P1 | READY FOR HOMOLOGATION | SAF-T Facturação F semântico + XSD + hash dedicado; dados históricos incompatíveis fail-closed |
| BILL-009 | Motor fiscal/IVA e arredondamentos | P1 | CLOSED | PR #122; motor fiscal canónico, perfis versionados, governance IVA/M21, resolver server-only, oracles e 28/28 testes fiscais |
| BILL-010 | Ciclo de vida completo dos documentos | P1 | CLOSED | PR #125; NC/ND canónicos, rejeição AGT/C, contingência, rectificação por novo documento, reversão fiscal/financeira e 33/33 testes fiscais |
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
- as implementações legadas de `emitir_recibo*` que escrevem em `documentos_emitidos` permanecem internas e sem EXECUTE directo; os nomes públicos foram restaurados apenas como wrappers de compatibilidade para **comprovativo operacional não-fiscal**, autorizados por escola/role e sem ligação a `fiscal_documentos`, IVA, séries, SAF-T ou AGT;
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

**Estado:** CLOSED
**Severidade:** P1
**PR:** #122
**Branch:** `fix/bill-009-tax-engine-vat`
**Fechado internamente em:** 2026-09-27

### Escopo fechado

- `fiscal_tax_profiles` é a fonte canónica da classificação tributária;
- perfis são versionados por `code + version`, com vigência temporal;
- sobreposição de períodos para o mesmo perfil é bloqueada por exclusion constraint;
- perfil/versionamento já usado por linha fiscal não pode ser alterado ou apagado;
- cada nova linha fiscal congela `tax_profile_code + tax_profile_version`;
- `fiscal_tax_compute_document(...)` é o motor canónico de cálculo;
- `fiscal_emitir_documento` usa o motor antes de persistir documento/linhas;
- mapper AGT e SAF-T consomem o snapshot fiscal persistido e não reinterpretam IVA;
- precisão de `unitPrice` / `unitPriceBase` é preservada no payload AGT;
- FX usa o contravalor AOA persistido pelo motor SQL, sem recálculo paralelo em JavaScript;
- descontos/settlement são reconciliados contra a linha canónica;
- impostos/retenções ainda não suportados permanecem fail-closed.

### Perfis suportados no motor actual

- `IVA_EDUCACAO_M21`;
- `IVA_NORMAL_14_AO`;
- `IVA_SIMPLIFICADO_M00`;
- `IVA_EXCLUSAO_M04`.

A existência do perfil não autoriza seu uso por qualquer entidade. O motor aplica governance por empresa fiscal.

### Governance de IVA e M21

A isenção de ensino deixou de ser inferida pelo nome/tipo do tenant.

`fiscal_empresas` mantém decisão explícita e auditável de:

- regime IVA: `unverified | general | simplified | exclusion`;
- elegibilidade da isenção de ensino: `unverified | eligible | not_eligible`;
- fundamento/evidência;
- actor verificador;
- timestamp da verificação.

Regras:

- `unverified` é fail-closed;
- M21 exige regime compatível + elegibilidade de ensino previamente verificada;
- IVA normal 14% exige regime geral;
- M00 exige regime simplificado;
- M04 exige regime de exclusão;
- alterações de enquadramento fiscal são protegidas por fluxo administrativo/super-admin;
- `fiscal_resolve_education_tax_profile(uuid)` é server-only: `anon=false`, `authenticated=false`, `service_role=true`.

O resolver retorna:

- regime geral + ensino elegível -> `IVA_EDUCACAO_M21`;
- regime geral + ensino não elegível -> `IVA_NORMAL_14_AO`;
- regime simplificado + ensino não elegível -> `IVA_SIMPLIFICADO_M00`;
- regime de exclusão -> `IVA_EXCLUSAO_M04`;
- enquadramento não verificado -> erro, sem fallback silencioso.

### Remoção do M21 implícito

O backfill antigo tinha classificado todas as `financeiro_tabelas` como M21.

Snapshot anterior ao fechamento:

- tabelas financeiras: **77**;
- M21 implícito: **77**.

Migration de fechamento removeu essa inferência.

Snapshot posterior:

- tabelas financeiras: **77**;
- M21 implícito: **0**;
- tabelas sem perfil explícito: **77**.

Isto não altera documentos fiscais emitidos. É apenas limpeza da configuração futura do catálogo.

Fluxos de mensalidade/propina agora resolvem o perfil fiscal server-side pela empresa fiscal. Pagamento financeiro directo sem mensalidade/origem fiscal classificada fica fiscalmente pendente e não é emitido automaticamente como serviço de ensino.

### Evidência de cálculo / oracles

Testes directos no motor SQL:

- `23.144 -> 23.15`;
- `0.001844 -> 0.01`;
- `5.9999999 -> 6.00`;
- M21: 100000 líquido / 0 imposto / 100000 bruto;
- IVA 14% sobre 165.3143: líquido 165.31 / imposto 23.15 / bruto 188.46;
- desconto 100 -> 90: settlement 10 / imposto 12.60 / bruto 102.60;
- USD 50 @ 920: líquido AOA 46000 / imposto AOA 6440 / bruto AOA 52440.

Testes rollback-only:

- overlap temporal de perfil rejeitado, **0 resíduos**;
- UPDATE/DELETE de perfil usado rejeitado, **0 resíduos**;
- resolver de regime/elegibilidade validado nos quatro cenários suportados;
- regime `unverified` rejeitado;
- nenhuma entidade/linha de teste persistida após rollback.

### CI

No run fiscal de referência do PR #122:

- Security Regression Tests: PASS;
- Fiscal Regression Tests: **28/28 PASS**;
- SAF-T XSD AO 1.01_01: PASS.

O workflow global ainda pode aparecer vermelho por débitos não introduzidos pelo BILL-009:

- KF2 Search Audit possui findings históricos de LIMIT/ORDER BY;
- Vercel tem falhado por `build-rate-limit`.

Essas falhas não alteram o resultado da suite fiscal do BILL-009.

### Advisors

Security/performance advisors foram revistos após as migrations.

Não apareceu finding novo ligado às novas estruturas de governance `education_vat_exemption_*`, `vat_regime_*`, resolver ou catálogo tributário.

Persistem warnings/info fiscais anteriores, incluindo RPCs SECURITY DEFINER e FKs sem índices, que devem ser tratados na auditoria de least privilege/performance do BILL-011 quando aplicável; não foram criados por este fechamento.

### Migrations BILL-009 live/Git

- `20260927181109_bill_009_tax_profiles_and_item_semantics.sql`
- `20260927181334_bill_009_financial_catalog_tax_profiles.sql`
- `20260927181708_bill_009_tax_compute_function.sql`
- `20260927181922_bill_009_wire_tax_engine_to_emitter.sql`
- `20260927182435_bill_009_catalog_fiscal_classification.sql`
- `20260927182915_bill_009_tuition_tax_profile_default.sql` — migration histórica do branch; comportamento posteriormente revogado;
- `20260927183018_bill_009_preserve_reserved_agt_invoice_no.sql`
- `20260927185100_bill_009_tax_profile_temporal_governance.sql`
- `20260927185604_bill_009_persist_tax_profile_version.sql`
- `20260927190709_bill_009_education_vat_eligibility_guard.sql`
- `20260927191357_bill_009_resolve_education_tax_profile.sql`
- `20260927191520_bill_009_tax_profile_resolver_server_only.sql`
- `20260927192036_bill_009_vat_regime_governance.sql`
- `20260927194402_bill_009_remove_implicit_education_tax_profile.sql`
- `20260927195400_bill_009_school_fiscal_engine_opt_in_gate.sql`

### Rollout por escola — opt-in obrigatório

O motor fiscal está implementado, mas **não está activado automaticamente para nenhuma escola**.

`fiscal_escola_bindings` possui gate operacional explícito:

- `fiscal_enabled=false` por default;
- binding escola <-> empresa fiscal não significa activação;
- status `active` da empresa fiscal também não significa activação;
- pagamentos, balcão, vendas e cadastro financeiro continuam a operar sem fiscal quando o gate está desligado;
- FT/FR/RC automáticos, links/outbox e reprocessamento financeiro-fiscal só podem iniciar quando `fiscal_enabled=true` para o binding vigente;
- chamadas de baixo nível de pagamento fiscal também rejeitam emissão sem opt-in;
- o core fiscal permanece disponível isoladamente para desenvolvimento, testes e homologação.

Snapshot em 2026-09-27:

- bindings fiscais existentes: **2**;
- bindings com motor activado: **0**;
- links financeiros fiscais `pending/failed`: **0**.

### Compatibilidade do pagamento/recibo operacional

O rollout fiscal não pode interromper o financeiro existente.

A migration `20260927202623_restore_operational_receipts_compat.sql` restaura os contratos `emitir_recibo(uuid)` e `emitir_recibo_servicos(uuid)` apenas como wrappers de compatibilidade para o comprovativo escolar existente:

- comprovativo operacional, explicitamente fora do escopo AGT/SAF-T;
- implementação original renomeada para funções internas sem EXECUTE por papéis de aplicação;
- wrappers públicos exigem `user_has_role_in_school(...)`;
- somente `authenticated` recebe EXECUTE;
- `anon` e `service_role` não recebem EXECUTE;
- utilizador de outra escola recebe `FORBIDDEN`;
- o pagamento continua a ser processado pelo ledger financeiro mesmo com `fiscal_enabled=false`.

Evidência live:
- utilizador financeiro autorizado recuperou recibo de mensalidade existente;
- utilizador autorizado recuperou recibo de serviço existente;
- utilizador de outra escola foi rejeitado;
- pagamento rollback-only chegou a `settled` sem `fiscal_documento_id`, sem link fiscal e sem resíduos.

A decisão de ligar uma escola ao motor é uma decisão explícita de rollout/go-live e deve incluir validação do regime IVA, elegibilidade M21 quando aplicável, séries/chaves e readiness AGT.

### Limites deliberados

- nenhum documento fiscal histórico foi renumerado, reclassificado ou alterado;
- retenções/IS/IEC/CEOC não são inferidos: continuam fail-closed até requisito aplicável ser provado;
- correções de histórico, NC/ND, rejeição/anulação/contingência pertencem ao BILL-010;
- homologação externa AGT continua separada no BILL-013.

### Critério de fechamento

Os critérios internos do BILL-009 foram atingidos:

1. emissões novas passam pelo motor canónico;
2. callers fiscais não calculam IVA por conta própria;
3. perfil + versão ficam congelados no item;
4. versões são reproduzíveis e não sobrepostas;
5. combinações inválidas falham fechado;
6. desconto/FX reconciliam entre DB e mappers;
7. arredondamento possui oracle;
8. produto/serviço e operationType são persistidos;
9. histórico emitido não foi mutado;
10. migrations live/Git estão sincronizadas e advisors foram revistos.

---

## BILL-010 — Ciclo de vida documental

**Estado:** CLOSED
**Severidade:** P1
**PR:** #125
**Branch:** `fix/bill-010-document-lifecycle`
**Fechado internamente em:** 2026-09-27

### Escopo fechado

- NC exige `rectifica_documento_id` canónico e mantém motivo/referência persistidos;
- ND exige `documento_origem_id` canónico;
- crédito acumulado por NC não pode ultrapassar o valor líquido do documento base;
- documentos rejeitados pela AGT usam novo documento com `documentStatus=C`;
- `agt_rejected_document_id` e `agt_rejected_document_no` são derivados/persistidos sem reescrever o original;
- resultado AGT por documento é idempotente e não pode regredir de terminal inválido para válido;
- rectificação do original exige documento correctivo emitido e, quando o original já entrou no fluxo AGT, respeita o resultado terminal/aceite aplicável;
- a UI/API de rectificação exige explicitamente `correction_document_id`; não existe mais rectificação por simples mudança de status;
- anulação local é bloqueada para documento FE já comunicado à AGT; não existe fallback local que finja anulação externa;
- contingência é derivada da série e exige coerência `origem_documento=contingencia <-> seriesContingencyIndicator=C`;
- séries FE (`FT/FR/FG/GF/NC/ND/RC`) exigem provisionamento AGT;
- `PP/GR/GT` usam série local controlada `legacy` e não entram no outbox de Facturação Electrónica;
- `estornar_mensalidade(uuid,text)` foi desactivado para papéis de aplicação;
- a rota de estorno usa `reverter_pagamento_realizado`, preservando ledger/alocações/reversões;
- pagamento fiscalizado continua fail-closed até existir resolução fiscal compatível;
- FR rectificada só libera reversão financeira após NC efectiva integral; RC continua bloqueado até existir fluxo fiscal homologado de anulação/RE;
- relações de lifecycle e lookup de submissões receberam índices de suporte.

### Migrations BILL-010 live/Git

- `20260927210453_bill_010_document_lifecycle_core.sql`
- `20260927211022_bill_010_document_lifecycle_invariants.sql`
- `20260927211031_bill_010_agt_result_backend_guard.sql`
- `20260927211210_bill_010_agt_lifecycle_event_types.sql`
- `20260927211445_bill_010_reconcile_lifecycle_guard.sql`
- `20260927211718_bill_010_reconcile_document_lifecycle_guards.sql`
- `20260927212200_bill_010_lifecycle_source_alignment.sql`
- `20260927212211_bill_010_series_boundary_and_reversal_gate.sql`
- `20260927212653_bill_010_financial_reversal_after_fiscal_correction.sql`
- `20260927213601_bill_010_lifecycle_reference_indexes.sql`

As versões/nomes acima foram reconciliados entre Git e o histórico de migrations do Supabase live.

### Evidência live

- `fiscal_document_lifecycle_guard` activo em `fiscal_documentos`;
- `trg_pagamentos_fiscal_reversal_guard` activo em `pagamentos`;
- `anon` sem EXECUTE em anular/rectificar;
- `authenticated` com EXECUTE apenas nos RPCs de anular/rectificar, que revalidam `user_has_role_in_empresa(owner/admin/operator)`;
- `fiscal_agt_record_document_result` permanece backend-only: `authenticated=false`, `service_role=true`;
- RPC legado `estornar_mensalidade` sem EXECUTE para `authenticated`;
- reserva rollback-only em série local PP produziu `PP-000004` e deixou `ultimo_numero=3` após rollback;
- tentativa de reservar número em série FT legacy falhou fechado por ausência de provisionamento AGT;
- tentativa autenticada de rectificar sem `correction_document_id` falhou fechado;
- histórico actual: 5 documentos `rectificado` e 4 `anulado`, todos com evento correspondente.

### CI do PR #125

Head validado: `3b21fcf644db5d89284aa75e99965da68cd8775d`.

- KLASSE UI Standards: PASS;
- Security Regression Tests: PASS;
- Fiscal Regression Tests: **33/33 PASS**;
- SAF-T XSD validator: instalado/executado pelo workflow antes da suite fiscal;
- KF2 Search Audit: continua vermelho por débito global do repositório, mas nenhum arquivo modificado pelo BILL-010 permanece nos findings após aplicação das invariantes KF2 à listagem fiscal.

### Advisors

Findings directamente ligados ao BILL-010:

- `fiscal_anular_documento` e `fiscal_rectificar_documento` aparecem como WARN por serem SECURITY DEFINER executáveis por `authenticated`; isto é intencional e ambos fazem autorização interna por empresa/role;
- `anon` permanece sem EXECUTE;
- os warnings de FK sem índice para `documento_origem_id`, `rectifica_documento_id` e `fiscal_agt_submission_documentos.empresa_id` foram eliminados pela migration `20260927213601...`.

A auditoria global de SECURITY DEFINER/RLS/grants continua no BILL-011.

### Histórico legado preservado

Não houve UPDATE correctivo em documentos emitidos.

Snapshot encontrado durante o fechamento:

- existem **5 documentos históricos já marcados `rectificado`** cujos eventos antigos não guardaram `correction_document_id`;
- esses registos são anteriores ao contrato BILL-010;
- o sistema não inventou relação retroactiva;
- novos fluxos não conseguem fechar rectificação sem documento correctivo explícito.

Continuam igualmente preservados os históricos já conhecidos do BILL-008:

- 98 documentos comerciais fora do formato canónico SAF-T;
- 8 RC históricos sem `paymentReceipt.sourceDocuments`.

Esses históricos permanecem evidência de legado e não devem ser “corrigidos” por mutação silenciosa.

### Limite externo deliberado

Para documento FE já comunicado à AGT, a anulação local é bloqueada. O conjunto público de serviços AGT validado durante este trabalho não forneceu evidência suficiente de um endpoint dedicado de anulação que permita implementar esse caminho sem inferência.

Portanto:
- não existe fallback local;
- a implementação externa de anulação/RE fica condicionada à evidência de homologação;
- essa prova entra no BILL-013.

### Critério de fechamento

O BILL-010 está CLOSED porque o lifecycle interno conhecido está implementado e protegido fail-closed:

1. referência NC/ND canónica;
2. limite de crédito;
3. correcção de rejeição AGT com nova identidade documental;
4. transições terminais sem regressão;
5. rectificação vinculada a correctivo real;
6. anulação FE não simulada;
7. contingência coerente;
8. separação série FE x série local PP/GR/GT;
9. reversão financeira vinculada à resolução fiscal;
10. UI/API alinhadas ao contrato;
11. migrations Git/live reconciliadas;
12. CI fiscal/security/UI verde no escopo.

A evidência contra AGT real continua separada e não é requisito para declarar este backlog interno CLOSED; pertence ao BILL-013.

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

### Cross-check oficial AGT — 2026-09-27

Fonte normativa principal:

`https://portaldoparceiro.minfin.gov.ao/doc-agt/faturacao-electronica/1/servicos/registar.html`

Páginas auxiliares usadas somente para resolver contratos relacionados:

- `/servicos/consultar.html` — `obterEstado`;
- `/estrutura.html` — estrutura JWS;
- `/gestao.html` — custódia/chaves.

#### Conforme / provado no código ou live

- `registarFactura` HML/produção: endpoints alinhados;
- Basic Auth + JSON: alinhado;
- `schemaVersion=2.0`;
- `submissionUUID` persistido e preservado nos retries;
- máximo 30 documentos por chamada;
- `numberOfEntries = documents.length`;
- assinatura de documento RS256 sobre:
  `documentNo,taxRegistrationNumber,documentType,documentDate,customerTaxID,customerCountry,companyName,documentTotals`;
- `documentStatus=N/C` e `rejectedDocumentNo` com novo número para correcção;
- RC sem `lines` e com `paymentReceipt.sourceDocuments`;
- NC com `referenceInfo`;
- tipos FE usados pelo KLASSE: FT/FR/NC/ND/RC/RE;
- `operationType=SE` suportado para educação;
- IVA/isencão e `taxExemptionCode`;
- `taxContribution` usa `fiscal_tax_ceil_cent` no motor SQL canónico;
- exemplos oficiais codificados na readiness:
  `23.144 -> 23.15`, `0.001844 -> 0.01`, `5.9999999 -> 6.00`;
- FX usa contravalor AOA persistido e arredondamento matemático a 2 casas no motor canónico;
- `requestID` obrigatório e limitado a 15;
- `obterEstado` assina `taxRegistrationNumber + requestID`;
- result codes 0/1/2/7/8/9;
- HTTP 422/429 do polling são tratados como transitórios, não como rejeição fiscal;
- vínculo `fiscal_empresas.certificado_agt_numero` x `softwareValidationNumber` é fail-closed.

#### Gap local corrigido no branch

A AGT exige `documentNo` entre 8 e 60 caracteres.

Snapshot live encontrou 11 documentos históricos com 7 caracteres
(ex.: `FR FR/1`, `RC RC/8`). Todos pertencem a séries `agt_status=legacy`;
não foram renumerados nem alterados.

O mapper passou a rejeitar qualquer submissão FE cujo `documentNo` esteja fora
de 8–60 caracteres ou tenha espaços periféricos. Teste unitário adicionado.

#### Ambiguidades do próprio documento AGT — bloquear decisão até homologação

1. `signatureVersion`:
   - a tabela de `registarFactura` o marca obrigatório dentro de `softwareInfoDetail`;
   - o exemplo de `registarFactura`, o exemplo de `obterEstado` e a página
     `estrutura.html` mostram/assinam somente
     `productId,productVersion,softwareValidationNumber`.
   - o KLASSE configura `signatureVersion`, mas actualmente não o transmite dentro
     de `softwareInfoDetail`.
   - não alterar o JWS por inferência; provar em HML qual contrato a AGT realmente aceita.

2. `jwsSignature` em `registarFactura`:
   - a tabela/payload de entrada de `registarFactura` não lista o campo;
   - a lista de erros inclui E40 para assinatura da chamada;
   - `estrutura.html` diz que requisições importantes podem usar `jwsSignature`.
   - o KLASSE não envia `jwsSignature` top-level em `registarFactura`.
   - tratar como hipótese de homologação, não inventar payload antes da resposta real da AGT.

#### Funcionalidades AGT não suportadas pelo escopo actual do KLASSE

- `taxBase` para correcções exclusivamente de imposto: não modelado; o motor bloqueia
  quantidade zero, portanto esse caso não é emitido silenciosamente;
- `withholdingTaxList`: contrato AGT existe, mas o mapper KLASSE falha fechado quando
  retenções/cativações são detectadas;
- exportação/factura AOA com contravalor em divisa: fora do fluxo escolar actual;
- tipos AR/RG/FA/FG/GF/AC/TV/AF/RP/RA/CS/LD não são emitidos pelo produto actual.

#### Gate de homologação

O BILL-013 só pode fechar depois de capturar evidência real HML para:

- forma exacta de `softwareInfoDetail`/JWS quanto a `signatureVersion`;
- necessidade ou não de `jwsSignature` em `registarFactura`;
- FT/FR/NC/ND/RC/RE;
- isenção, FX, rejeição intencional, duplicate submission;
- `obterEstado` V/I + 7/8 + 422/429;
- requests/responses sanitizados e persistidos.


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

`BILL-011 -> BILL-012 -> BILL-013 -> BILL-014`

BILL-005 e BILL-006 permanecem ligados ao BILL-013 exclusivamente para evidência externa de homologação AGT.

## BILL-018 — Idempotência de pagamentos (hardening 2026-09-27)

**Estado:** READY FOR STAGING — NOT LIVE
**Severidade:** P0

### Evidência live antes do hardening

Snapshot do Supabase de produção:

- `public.pagamentos`: **4.162** linhas históricas com `idempotency_key IS NULL`;
- último histórico NULL observado: **2026-09-26**;
- no snapshot de 2026-09-27 não existia pagamento live com `idempotency_key` preenchida;
- `ux_pagamentos_escola_idempotency` já existe como unique index parcial para chaves não nulas.

**Decisão:** não fazer backfill artificial. Os NULL históricos permanecem imutáveis. A regra nova é prospectiva: todo novo pagamento precisa de identidade estável.

### Writers corrigidos no branch

- `/api/financeiro/pagamentos/registrar`;
- `/api/secretaria/balcao/pagamentos`;
- `/api/financeiro/conciliacao/settle`;
- `/api/escolas/[id]/financeiro/vendas/avulsa`;
- `/api/escolas/[id]/financeiro/pagamentos/novo`;
- `/api/financeiro/pagamentos/mcx`;
- `/api/aluno/financeiro/comprovativo`;
- `RegistoPagamentoModal` / Server Action financeira;
- `PaymentDrawer` do aluno;
- webhook MCX: dedupe derivado de `transactionId + status`, sem depender de `Idempotency-Key` fornecida pelo provider.

As chaves de comandos HTTP/UI são scoped antes de chegar a `pagamentos.idempotency_key`, evitando colisão entre entrypoints. O MCX faz claim em `idempotency_keys` **antes** de chamar o provider para impedir corrida de duas requests iguais. Timeout/exceção após o claim ou falha de persistência após aceite ficam `MCX_OUTCOME_UNCERTAIN`; retries não chamam o provider novamente. O valor do comando MCX usa `exactMoney`/`moneyToJson`, não `Number()`.

### Guard DB preparado

Migration:

`20260928002000_bill_018_payment_idempotency_hardening.sql`

Contrato:

1. preserva todos os NULL históricos;
2. exige identidade forte em qualquer novo INSERT;
3. aceita somente identidade explícita/derivável de fonte forte:
   - `idempotency_key`;
   - `meta.idempotency_key` durante compatibilidade;
   - `pagamento_intent_id`;
   - `transacao_id_externo` do provider;
4. nunca deriva identidade de valor/data/aluno;
5. limita a 200 caracteres;
6. torna `idempotency_key` imutável após criação;
7. revoga EXECUTE dos RPCs não-idempotentes `registrar_pagamento` e `realizar_pagamento_balcao`.

Produção mostrou **0** pagamentos com `meta.origem='registrar_pagamento_compat'`, portanto esses RPCs são superfície legada sem evidência de uso no dataset actual.

### Evidência de readiness adicionada

- INSERT de novo pagamento sem chave deve falhar com `IDEMPOTENCY:`;
- tentativa de alterar a chave de pagamento existente deve falhar com `IMMUTABILITY:`;
- unique index parcial deve existir;
- coluna física permanece nullable para não adulterar históricos;
- RPCs legados devem estar sem EXECUTE para `authenticated`.

Arquivos:

- `tools/fiscal/readiness-db.sql`;
- `supabase/ops/tests/fiscal_readiness_post_bill010.sql`;
- `apps/web/tests/unit/payment-idempotency.spec.ts`.

### Gate pendente

O projecto Supabase live não possui development branch/staging disponível no momento da auditoria. Por regra de segurança deste backlog, a migration de enforcement **não foi aplicada directamente em produção**.

Para fechar BILL-018:

1. aplicar migration em staging/branch;
2. executar os negative tests acima + regressões BILL-001–003;
3. provar que nenhum writer legítimo gera NULL;
4. promover a mesma migration para live;
5. confirmar que os 4.162 históricos continuam intocados;
6. confirmar que novos pagamentos entram sempre com chave;
7. CI do PR deve estar verde ou qualquer falha deve ser classificada como preexistente/infra com evidência.

Sem esses gates, BILL-018 permanece READY FOR STAGING, não CLOSED.

## BILL-013 — HML contract probe status (2026-09-27)

**Estado:** TOOLING READY — EXTERNAL BINDING BLOCKED

Implementado:

- `agtContract.ts` com `docs-example` e `table-strict`;
- `FISCAL_AGT_SOFTWARE_INFO_MODE` para alternar o shape de
  `softwareInfoDetail` sem alterar o default actual;
- `jwsSoftwareSignature` assina sempre exactamente o objecto transmitido;
- `fiscal:agt:hml:preflight`: valida HML oficial, configuração, certificado e
  KMS sem network side effect;
- `fiscal:agt:hml:submit`: baseline FT/FR com ACK explícito,
  `submissionUUID` e timestamp persistidos pelo operador;
- um único `registarFactura` + um único `obterEstado`;
- 422/429 são reportados como transitórios, sem loop/retry automático;
- o probe recusa produção e hosts diferentes de
  `sifphml.minfin.gov.ao`.

Evidência live:

- 3 empresas fiscais;
- 0 empresas com `certificado_agt_numero`;
- 2 chaves fiscais activas;
- 2/2 chaves activas são referências KMS.

Portanto não existe condição legítima para executar HML real ainda.
Nenhum número de certificado foi inventado ou backfillado.

CI do head que introduziu o tooling:

- KLASSE UI Standards: PASS;
- Security Regression: 4/4 PASS;
- Fiscal Regression: 58/58 PASS;
- KF2 global: FAIL apenas por findings preexistentes de LIMIT/ORDER BY/select('*')
  fora dos arquivos fiscais alterados.

Próximo gate real:

1. obter/vincular `certificado_agt_numero` verdadeiro à empresa de homologação;
2. garantir envs AGT HML + software KMS configuradas;
3. rodar `pnpm fiscal:agt:hml:preflight`;
4. criar/separar FT ou FR de homologação;
5. executar primeiro em `docs-example`;
6. se a resposta indicar E08/E39 ou ausência de `signatureVersion`, repetir a
   mesma matriz documental com nova submissão explícita em `table-strict`;
7. persistir a evidência sanitizada antes de decidir o contrato definitivo;
8. não implementar `jwsSignature` top-level de `registarFactura` sem evidência
   HML, pois a documentação oficial não especifica o payload exacto a assinar.
