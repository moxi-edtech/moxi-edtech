# Handoff — Certificação Fiscal AGT / BILL-009 em diante

Data: 2026-09-27
Repositório: `moxi-edtech/moxi-edtech`
Branch de continuação: `fix/bill-010-document-lifecycle`
PR de referência: `#125`

## Objetivo

Continuar o fechamento técnico dos gaps fiscais do KLASSE para preparação de certificação/homologação AGT em Angola.

Não declarar o KLASSE “certificado” enquanto não houver evidência externa real da AGT. O objetivo dos BILLs é deixar código, banco, segurança, documentos e testes prontos para homologação e produzir evidência reproduzível.

A fonte canónica do estado é:

`docs/fiscal/certificacao/backlog-certificacao-agt.md`

Este handoff explica como continuar sem reabrir decisões já validadas.

---

## Stack actual dos PRs

Os trabalhos estão empilhados, não independentes:

- PR #118 — BILL-001–005 — `fix(fiscal): close BILL-001–005 hardening blockers`
- PR #119 — BILL-006 — Facturação Electrónica AGT/outbox
- PR #120 — BILL-007 — pagamentos/ledger/RC
- PR #121 — BILL-008 — SAF-T(AO) semântico
- PR #122 — BILL-009 — motor fiscal/IVA
- PR #125 — BILL-010 — ciclo documental

Os trabalhos fiscais são empilhados. Não perder a ordem de dependência ao fazer merge/rebase.

---

## Estado dos BILLs

- BILL-001 — CLOSED
- BILL-002 — CLOSED
- BILL-003 — CLOSED
- BILL-004 — CLOSED
- BILL-005 — READY FOR HOMOLOGATION
- BILL-006 — READY FOR HOMOLOGATION
- BILL-007 — CLOSED
- BILL-008 — READY FOR HOMOLOGATION para SAF-T Facturação (`TaxAccountingBasis=F`)
- BILL-009 — CLOSED
- BILL-010 — CLOSED
- BILL-011 — PRÓXIMO / BACKLOG
- BILL-012 — BACKLOG
- BILL-013 — BACKLOG
- BILL-014 — BACKLOG

BILL-005, BILL-006 e BILL-008 só devem virar CLOSED depois da evidência externa prevista no BILL-013.

---

## Invariantes que NÃO podem ser quebrados

1. Documento fiscal emitido é imutável. Não resolver bugs alterando/apagando documentos emitidos.
2. Itens fiscais e eventos são append-only.
3. Numeração fiscal é reservada atomicamente no banco.
4. Série de produção FE deve estar provisionada pela AGT.
5. Emissão usa um único contrato `fiscal_emitir_documento`.
6. Documento nasce `pendente_assinatura` e a assinatura é finalizada no backend.
7. A integração AGT é assíncrona:
   `emitido -> outbox -> registarFactura -> requestID -> obterEstado -> V/I`.
8. O mesmo documento fiscal não recebe uma nova identidade de submissão por timeout/retry.
9. Pagamento é aplicado por RPC canónica/idempotente.
10. Ledger, alocações, reversões e estornos preservam histórico.
11. RC deriva das alocações reais e usa `paymentReceipt.sourceDocuments`; RC não inventa linhas fiscais.
12. Pagamento parcial exige FT/ND fiscal de origem.
13. Reversão financeira de pagamento fiscalizado é fail-closed até o ciclo documental ser resolvido no BILL-010.
14. SAF-T não “corrige” documento histórico silenciosamente.
15. SAF-T Facturação é suportado; SAF-T Contabilidade C/I não deve ser declarado sem plano de contas + razão contabilístico real.
16. Alterações de banco devem entrar via migration e o mesmo SQL deve existir no Git.
17. Testes contra dados reais devem ser rollback-only quando houver risco de produzir documento/estado financeiro.
18. Nunca expor chave privada fiscal, secret, credential AGT ou KMS material para client/browser.

---

## Arquitectura fiscal actual

Fluxo principal:

`financeiro/catalogo/mensalidade -> pagamento -> alocação financeira -> fiscal_emitir_documento -> fiscal_documentos + fiscal_documento_itens -> assinatura -> emitido -> AGT outbox -> registarFactura -> obterEstado`

Para pagamento diferido:

`FT/ND -> pagamento -> financeiro_pagamento_alocacoes -> RC -> financeiro_recibo_alocacoes -> paymentReceipt.sourceDocuments -> AGT`

SAF-T:

`fiscal_documentos + fiscal_documento_itens + eventos + séries -> saftAo.ts -> validação semântica -> XSD AO 1.01_01 -> storage privado -> fiscal_saft_exports`

O SAF-T possui cadeia de hash própria quando o software estiver validado; não reutilizar a assinatura JWS/RSA-2048 da Facturação Electrónica como campo `Hash` do SAF-T.

---

## BILL-009 — FECHADO

O BILL-009 foi fechado internamente no PR #122 em 2026-09-27.

### Resultado

O KLASSE possui agora um motor fiscal canónico no banco com:

- perfis tributários versionados e com vigência;
- exclusão de períodos sobrepostos;
- imutabilidade de perfil/versionamento já usado;
- snapshot `tax_profile_code + tax_profile_version` por linha;
- cálculo canónico de IVA, desconto, settlement e FX;
- AGT e SAF-T consumindo valores persistidos;
- outros impostos/retenções não suportados em modo fail-closed.

### Governance IVA / ensino

A isenção M21 não é mais default de propina.

`fiscal_empresas` exige decisão fiscal explícita e auditável de:

- regime IVA;
- elegibilidade da isenção de ensino;
- fundamento;
- verificador;
- timestamp.

`fiscal_resolve_education_tax_profile(uuid)` é server-only e resolve:

- general + eligible -> M21;
- general + not_eligible -> IVA 14%;
- simplified + not_eligible -> M00;
- exclusion -> M04;
- unverified -> erro.

A aplicação não pode assumir que uma entidade é elegível por ser escola/centro.

### Remoção do estado implícito

O backfill original do BILL-009 havia aplicado M21 a 77/77 `financeiro_tabelas`.

A migration `20260927194402_bill_009_remove_implicit_education_tax_profile.sql` removeu esse estado:

- total: 77;
- M21 implícito após cleanup: 0;
- sem perfil explícito: 77.

Nenhum documento emitido foi alterado.

Fluxos de mensalidade, balcão e reprocessamento resolvem o enquadramento pela empresa fiscal. Pagamento directo sem origem fiscal classificada fica fail-closed para emissão automática.

### Migrations adicionais do fechamento

Além das migrations iniciais já documentadas:

- `20260927185100_bill_009_tax_profile_temporal_governance.sql`;
- `20260927185604_bill_009_persist_tax_profile_version.sql`;
- `20260927190709_bill_009_education_vat_eligibility_guard.sql`;
- `20260927191357_bill_009_resolve_education_tax_profile.sql`;
- `20260927191520_bill_009_tax_profile_resolver_server_only.sql`;
- `20260927192036_bill_009_vat_regime_governance.sql`;
- `20260927194402_bill_009_remove_implicit_education_tax_profile.sql`;
- `20260927195400_bill_009_school_fiscal_engine_opt_in_gate.sql`.

### Evidência

Oracles SQL:

- 23.144 -> 23.15;
- 0.001844 -> 0.01;
- 5.9999999 -> 6.00;
- M21, IVA normal, desconto e FX reconciliados.

Governance rollback-only:

- general + eligible -> M21;
- general + not_eligible -> 14%;
- simplified + not_eligible -> M00;
- exclusion -> M04;
- unverified -> rejeitado;
- overlap temporal rejeitado;
- mutação de perfil usado rejeitada;
- zero resíduos.

CI fiscal de referência:

- Security Regression Tests: PASS;
- Fiscal Regression Tests: 28/28 PASS;
- XSD SAF-T AO 1.01_01: PASS.

KF2 Search Audit e Vercel build-rate-limit continuam como débitos globais/preexistentes e não são evidência de regressão do motor fiscal.

### Invariante de rollout

BILL-009 fecha o motor fiscal, **não activa o motor nas escolas**.

- `fiscal_escola_bindings.fiscal_enabled` é o gate operacional;
- default é `false`;
- binding e empresa fiscal `active` não são opt-in;
- com gate desligado, pagamentos/propinas/vendas continuam no fluxo financeiro normal, sem criar FT/FR/RC, link fiscal ou job de reprocessamento;
- o reprocessador também ignora escolas desactivadas;
- o adapter e os serviços de pagamento fiscal possuem defesa de baixo nível contra bypass;
- activar uma escola exige decisão explícita de rollout e readiness fiscal/AGT.

Estado verificado em 2026-09-27: **0 bindings activados**.

### Compatibilidade financeira enquanto fiscal está desligado

Pagamento e comprovativo operacional continuam independentes do motor fiscal.

Migration live/Git:

- `20260927202623_restore_operational_receipts_compat.sql`.

Ela preserva temporariamente os contratos `emitir_recibo(uuid)` e `emitir_recibo_servicos(uuid)` usados pelo código actualmente implantado, mas muda sua natureza para wrappers endurecidos de **comprovativo operacional não-fiscal**:

- wrappers verificam `user_has_role_in_school`;
- `authenticated` autorizado pode executar;
- `anon`, `service_role` e callers cross-tenant não podem;
- implementações originais foram renomeadas para `_emitir_recibo*_operacional_internal` e não têm EXECUTE directo;
- nenhum desses comprovativos entra em `fiscal_documentos`, SAF-T ou AGT.

Evidência live:
- mensalidade paga -> recibo operacional existente recuperado com sucesso;
- serviço pago -> recibo operacional existente recuperado com sucesso;
- utilizador de outra escola -> `FORBIDDEN`;
- RPC financeiro real -> `settled` com fiscal desligado, zero links/documentos fiscais e rollback sem resíduos.

O hotfix de aplicação `hotfix/payment-receipt-prod-8493` remove a dependência futura desses wrappers e passa a imprimir directamente de `pagamentos`.

### Invariante nova

Nunca voltar a aplicar M21 automaticamente por ser propina, mensalidade, escola, centro de formação ou `operationType=SE`.

A classificação de ensino depende do regime IVA e da elegibilidade fiscal previamente verificados. Se não houver decisão, falhar fechado.

---

## BILL-010 — FECHADO

O BILL-010 foi fechado internamente no PR #125 em 2026-09-27.

### Invariantes novas

1. Rectificação não é UPDATE de status: exige documento correctivo novo e emitido.
2. NC exige `rectifica_documento_id` e respeita o remanescente do documento base.
3. ND emitida pelo KLASSE exige `documento_origem_id`.
4. `documentStatus=C` só pode corrigir documento comprovadamente rejeitado pela AGT.
5. Correcção de rejeitado usa novo número e `rejectedDocumentNo` canónico.
6. Resultado AGT `valid/invalid` é terminal/idempotente.
7. Documento FE já no fluxo AGT não pode ser anulado apenas localmente.
8. Contingência deriva da série e exige coerência entre origem e indicador `C`.
9. FT/FR/FG/GF/NC/ND/RC exigem série FE provisionada.
10. PP/GR/GT usam séries locais controladas e ficam fora do outbox AGT.
11. Reversão financeira de FR só é liberada depois de correcção fiscal efectiva suficiente.
12. `estornar_mensalidade` legado não é mais executável; usar `reverter_pagamento_realizado`.
13. Histórico fiscal antigo não é reescrito para satisfazer o modelo novo.

### Evidência live

- 10 migrations BILL-010 com versão/nome idênticos em Git e Supabase;
- 1 único trigger de lifecycle em `fiscal_documentos`;
- trigger de reversão fiscal em `pagamentos`;
- 5 documentos históricos rectificados, todos com evento, mas os 5 eventos antigos não possuem ID do correctivo;
- 4 documentos históricos anulados, todos com evento;
- PP local: reserva rollback-only produziu `PP-000004` e o contador voltou para 3 após rollback;
- série FT legacy: reserva bloqueada por ausência de provisionamento AGT;
- rectificação sem `correction_document_id`: bloqueada;
- NC acima do remanescente: bloqueada pelo guard E42-style, sem resíduos.

### CI de referência

PR #125:

- UI Standards: PASS;
- Security Regression: PASS (4/4);
- Fiscal Regression: PASS (33/33);
- KF2 global continua com dívida histórica, mas nenhum arquivo BILL-010 permanece nos findings.

### Segurança

- `fiscal_agt_record_document_result`: service_role-only;
- `fiscal_anular_documento` / `fiscal_rectificar_documento`: authenticated + service_role, com autorização interna por empresa/role;
- `anon`: sem EXECUTE;
- `estornar_mensalidade`: removido dos papéis de aplicação.

### Limite externo deliberado

A anulação de documento FE já comunicado permanece fail-closed. O conjunto público de serviços AGT revisto reconhece documentos com anulação posterior, mas não forneceu um contrato público dedicado de anulação que possamos implementar e declarar homologado sem evidência.

A prova desse procedimento e o fluxo real AGT pertencem ao BILL-013.

---

## Próxima retomada — BILL-011

**BILL-011 — Segurança fiscal multi-tenant / least privilege**

Começar por:

- inventário completo de RLS nas tabelas fiscal/financeiro;
- grants de `anon`, `authenticated` e `service_role`;
- todos os `SECURITY DEFINER` e respectivos EXECUTE;
- isolamento empresa/escola e testes cross-tenant positivos/negativos;
- storage fiscal e signed URLs;
- referências KMS/secrets;
- tabelas financeiras legadas ainda com grants amplos;
- resolver WARNs fiscais dos advisors quando o privilégio não for explicitamente necessário.

Não alterar sem necessidade as decisões de lifecycle fechadas no BILL-010.

### Depois do BILL-011

- BILL-012 — observabilidade, DLQ, replay, reconciliação e alertas;
- BILL-013 — homologação externa AGT e fixtures reais;
- BILL-014 — governance, retenção, backup, dossiê e GO/NO-GO.

---

## Método de trabalho obrigatório

Para cada BILL:

1. Fazer discovery antes de alterar.
2. Ler banco vivo e código; não confiar só em docs antigos.
3. Para Supabase, usar migration para DDL.
4. Se migration já está live, versionar exactamente o mesmo SQL no Git — não reaplicar.
5. Preferir invariantes no banco a validação apenas na UI.
6. Usar fail-closed para estado fiscal ambíguo.
7. Fazer testes rollback-only para cenários reais.
8. Guardar evidência: função/tabela/migration/arquivo/commit.
9. Rodar unit/fiscal/security tests e advisors.
10. Distinguir regressão do BILL de falha preexistente do monorepo.
11. Actualizar `backlog-certificacao-agt.md` no mesmo PR.
12. Só depois mudar o estado do BILL.

---

## Limitações de CI conhecidas

O repositório possui falhas que não devem ser automaticamente atribuídas ao BILL corrente:

- Vercel tem apresentado `build-rate-limit`;
- KF2 Search Audit possui findings históricos de LIMIT/ORDER BY em outras áreas.

Sempre comparar o resultado com o branch-base antes de classificar como regressão.

---

## Instrução curta para continuar

Comece em:

`fix/bill-010-document-lifecycle`

Não recrie BILL-009 ou BILL-010. O próximo gap é **BILL-011**.

Primeiro execute:

- diff de `fix/bill-010-document-lifecycle` contra a base fiscal anterior;
- inventário de RLS/policies nas tabelas fiscal/financeiro;
- inventário de grants de `anon`, `authenticated` e `service_role`;
- inventário de todos os SECURITY DEFINER e respectivos EXECUTE;
- testes cross-tenant positivos/negativos por empresa e escola;
- auditoria de storage fiscal/signed URLs/KMS refs;
- advisors de segurança e performance.

Depois feche apenas os gaps do BILL-011. Não reabra invariantes de BILL-010 sem evidência concreta e não mutar histórico fiscal emitido.
