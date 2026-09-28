# Handoff — Backlogs Fiscais KLASSE / Certificação AGT

Data de referência: 2026-09-27  
Repo: `moxi-edtech/moxi-edtech`  
Branch de continuação: `fix/bill-010-document-lifecycle`  
PR de referência: **#125**  
Backlog canónico: `docs/fiscal/certificacao/backlog-certificacao-agt.md`

Este documento é o ponto de retomada operacional para continuar a preparação fiscal do KLASSE. O próximo backlog executável é **BILL-011**.

## 1. Ordem de autoridade

Preservar esta ordem:

1. documentação oficial AGT / Portal do Parceiro e XSD SAF-T(AO);
2. comportamento real do Supabase + migrations + código KLASSE;
3. testes executáveis, CI, advisors e evidência rollback-only;
4. OSS apenas como referência secundária.

Não alterar histórico fiscal para satisfazer requisito novo.

## 2. Stack e risco de drift

Stack fiscal construído em sequência:

`#118 -> #119 -> #120 -> #121 -> #122 -> #125`

- #118 — BILL-001–005;
- #119 — BILL-006;
- #120 — BILL-007;
- #121 — BILL-008;
- #122 — BILL-009;
- #125 — BILL-010.

O Supabase live contém migrations do stack mesmo enquanto PRs podem continuar abertos. Não iniciar BILL-011 a partir de `main` se `main` ainda não contiver integralmente o stack.

Use o head de `fix/bill-010-document-lifecycle` ou um sucessor que contenha todos os BILLs anteriores.

## 3. Estado consolidado

| BILL | Estado | Observação |
|---|---|---|
| BILL-001 | CLOSED | imutabilidade documental |
| BILL-002 | CLOSED | itens/eventos append-only |
| BILL-003 | CLOSED | numeração/séries atómicas |
| BILL-004 | CLOSED | emissão/assinatura canónica |
| BILL-005 | READY FOR HOMOLOGATION | falta série AGT real |
| BILL-006 | READY FOR HOMOLOGATION | falta prova registarFactura/obterEstado real |
| BILL-007 | CLOSED | ledger/alocações/RC/reversão |
| BILL-008 | READY FOR HOMOLOGATION | SAF-T Facturação F pronto; falta prova externa |
| BILL-009 | CLOSED | motor fiscal/IVA/governance |
| BILL-010 | CLOSED | lifecycle documental |
| BILL-011 | PRÓXIMO | segurança multi-tenant/least privilege |
| BILL-012 | BACKLOG | observabilidade/recovery |
| BILL-013 | BACKLOG | homologação externa AGT |
| BILL-014 | BACKLOG | governance/go-live |

`CLOSED` significa gap interno fechado no stack actual; não significa certificação AGT.

## 4. Invariantes que não podem regredir

1. documento fiscal emitido não é editado para corrigir história;
2. itens/eventos são append-only;
3. numeração fiscal é reservada atomicamente;
4. FT/FR/FG/GF/NC/ND/RC exigem série FE provisionada;
5. PP/GR/GT usam série local controlada e não entram em `registarFactura`;
6. emissão usa `fiscal_emitir_documento`;
7. documento nasce `pendente_assinatura`; assinatura é backend-only;
8. AGT é assíncrona: `emitido -> outbox -> registarFactura -> requestID -> obterEstado -> V/I`;
9. retry incerto não ganha nova identidade;
10. pagamento/ledger preservam alocações e reversões;
11. comprovativo operacional da escola não é documento fiscal AGT;
12. fiscal permanece opt-in por escola (`fiscal_enabled=false` por default);
13. RC fiscal deriva de alocações e `paymentReceipt.sourceDocuments`;
14. SAF-T Facturação F não altera histórico para ficar válido;
15. SAF-T C/I não é declarado sem contabilidade real;
16. migrations live devem existir com mesma versão/nome no Git;
17. teste destrutivo em dado real deve ser rollback-only;
18. credencial AGT/KMS não vai para browser;
19. estado/taxa/tipo/referência ambíguos falham fechado.

## 5. BILL-009 — fechado, sem activar escolas

O motor fiscal existe, mas não está ligado automaticamente às escolas.

`fiscal_escola_bindings.fiscal_enabled` é o gate.

Com `false`:

- propinas/pagamentos continuam no financeiro normal;
- comprovativo operacional continua disponível;
- não criar FT/FR/RC automático;
- não criar link/outbox/reprocessamento fiscal.

Estado verificado durante BILL-009: **0 bindings activados**.

A migration `20260927202623_restore_operational_receipts_compat.sql` preserva temporariamente `emitir_recibo*` como wrapper **operacional não-fiscal** para o código implantado. Isso não entra em `fiscal_documentos`, SAF-T ou AGT.

## 6. BILL-010 — CLOSED

PR #125 — `fix/bill-010-document-lifecycle`.

### Requisitos AGT implementados

- `documentStatus=N` normal;
- `documentStatus=C` apenas para correcção de documento rejeitado;
- `rejectedDocumentNo` canónico;
- novo número obrigatório após rejeição;
- NC com `referenceInfo`;
- razão de referência <= 60;
- limite cumulativo de crédito/anulação do documento base;
- V/I terminal/idempotente;
- série normal vs contingência.

### Modelo canónico

`fiscal_documentos` persiste:

- `agt_document_status`;
- `agt_rejected_document_id`;
- `agt_rejected_document_no`;
- `reference_reason`;
- `contingency_indicator`.

Há **um** trigger de lifecycle:

`fiscal_document_lifecycle_guard`.

### NC / ND

NC exige `rectifica_documento_id` e não pode exceder o remanescente.

ND KLASSE exige `documento_origem_id`.

Mapper AGT usa a relação canónica para `referenceInfo`.

### Rejeição AGT

`fiscal_agt_record_document_result`:

- apenas service_role;
- mesmo resultado repetido é idempotente;
- resultado terminal não pode mudar para o oposto;
- grava eventos AGT_VALIDADO/AGT_REJEITADO.

Correcção `C` exige rejeição AGT comprovada, mesmo tipo e novo número.

### Rectificação

Não marcar original como rectificado sem documento correctivo.

Correctivo permitido:

- NC referenciando original;
- ND referenciando original;
- documento `C` referenciando rejeitado.

Se o original entrou no fluxo AGT, o correctivo precisa validar/ser aceite antes de fechar o original.

API/UI exigem `correction_document_id`.

### Anulação

Documento FE já presente em `prepared/submitting/submitted/processing/uncertain/accepted` não é anulado apenas localmente.

O procedimento externo de anulação deverá ser provado em BILL-013. Até lá, fail-closed.

### Séries / contingência

FE:
`FT FR FG GF NC ND RC` -> série AGT provisionada.

Local:
`PP GR GT` -> série legacy controlada, sem outbox FE.

Prova rollback-only PP:

- próximo número retornado: `PP-000004`;
- após rollback, contador voltou a 3.

Série FT legacy rejeita reserva.

### Financeiro

`estornar_mensalidade` legado sem EXECUTE.

`/api/financeiro/mensalidades/estornar` usa `reverter_pagamento_realizado`.

`trg_pagamentos_fiscal_reversal_guard` impede reversão divergente.

FR fiscalizada só pode ser revertida depois de:

- anulação válida; ou
- rectificação com NC efectiva suficiente.

Se a FR foi aceita pela AGT, só NC validada/aceita conta para o crédito efectivo.

RC segue bloqueado até existir anulação/`RE` homologado.

### Histórico legado

Snapshot no fechamento:

- 5 documentos históricos `rectificado`, 0 sem evento;
- 4 `anulado`, 0 sem evento;
- os 5 eventos antigos de rectificação não têm ID do documento correctivo.

Não preencher retroactivamente esses IDs. Não inventar NC/ND. Não renumerar.

### Segurança

- anular/rectificar: authenticated + service_role; sem anon; autorização interna por `safe_auth_uid + user_has_role_in_empresa`;
- resultado AGT: service_role-only;
- bypass legado de estorno: sem EXECUTE.

### CI de referência

PR #125:

- UI Standards: PASS;
- Security Regression: PASS (4/4);
- Fiscal Regression: PASS (33/33);
- KF2 global ainda possui dívida histórica, porém nenhum arquivo BILL-010 ficou nos findings após aplicar invariantes KF2 à listagem fiscal.

### Advisors

Os FKs lifecycle que estavam sem cobertura receberam índices:

- `idx_fiscal_documentos_documento_origem`;
- `idx_fiscal_documentos_rectifica_documento`;
- `idx_fiscal_agt_submission_documentos_empresa`.

Warnings SECURITY DEFINER de anular/rectificar são intencionais e devem ser reavaliados no BILL-011 dentro da auditoria global de least privilege.

### Migrations BILL-010

1. `20260927210453_bill_010_document_lifecycle_core.sql`
2. `20260927211022_bill_010_document_lifecycle_invariants.sql`
3. `20260927211031_bill_010_agt_result_backend_guard.sql`
4. `20260927211210_bill_010_agt_lifecycle_event_types.sql`
5. `20260927211445_bill_010_reconcile_lifecycle_guard.sql`
6. `20260927211718_bill_010_reconcile_document_lifecycle_guards.sql`
7. `20260927212200_bill_010_lifecycle_source_alignment.sql`
8. `20260927212211_bill_010_series_boundary_and_reversal_gate.sql`
9. `20260927212653_bill_010_financial_reversal_after_fiscal_correction.sql`
10. `20260927213601_bill_010_lifecycle_reference_indexes.sql`

Git e Supabase live têm os mesmos version/name para esse conjunto.

## 7. Próxima implementação: BILL-011

Objetivo: segurança fiscal multi-tenant / least privilege.

Auditar e provar:

- RLS em todas as tabelas fiscal/financeiro;
- grants directos por `anon/authenticated/service_role`;
- todos os SECURITY DEFINER;
- EXECUTE e ownership;
- tenant isolation empresa/escola;
- storage fiscal / signed URLs;
- KMS refs e secret exposure;
- cross-tenant positive/negative tests;
- tabelas financeiras legadas com grants amplos;
- advisors e findings realmente relacionados.

Não usar `service_role` como substituto de autorização.

## 8. Depois

- BILL-012 — observabilidade/retries/recovery;
- BILL-013 — homologação AGT externa;
- BILL-014 — governance/go-live.

BILL-005/006/008 continuam dependentes do BILL-013 para evidência externa.

## 9. Protocolo obrigatório de fechamento

Cada BILL deve deixar:

1. escopo exacto;
2. fonte normativa;
3. branch/PR/commits;
4. migrations Git/live;
5. teste positivo;
6. teste negativo/fail-closed;
7. idempotência/race se aplicável;
8. grants/RLS/advisors se aplicável;
9. regression suite;
10. rollback/residue check;
11. prova externa quando o requisito depender da AGT;
12. backlog + handoff actualizados no mesmo PR.

Sem evidência suficiente: usar NEEDS WORK/BLOCKED/READY FOR HOMOLOGATION, nunca CLOSED.

## 10. Padrões proibidos

- editar fiscal histórico;
- copiar OSS e tratá-lo como norma AGT;
- fallback silencioso;
- número/série fora do fluxo canónico;
- nova submission identity após outcome incerto;
- credencial AGT/KMS no cliente;
- PUBLIC EXECUTE em SECURITY DEFINER;
- SAF-T C/I sem ledger contabilístico;
- reintroduzir recibo operacional como documento fiscal;
- fechar requisito externo sem prova externa.

## 11. Ponto exacto de retomada

Branch:

`fix/bill-010-document-lifecycle`

Próximo:

`BILL-011 — Segurança fiscal multi-tenant`

Ordem:

`BILL-011 -> BILL-012 -> BILL-013 -> BILL-014`

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

## AWS KMS runtime identity — Vercel OIDC (2026-09-27)

Provisioned in AWS account `050046455297`:

- OIDC provider: `arn:aws:iam::050046455297:oidc-provider/oidc.vercel.com/moxinexas-projects`;
- runtime role: `arn:aws:iam::050046455297:role/KLASSE-Vercel-FiscalSigner-Prod`;
- trusted audience: `https://vercel.com/moxinexas-projects`;
- trusted subject: `owner:moxinexas-projects:project:moxi-edtech:environment:production`;
- session duration: 3600 seconds;
- inline policy: `KLASSEFiscalKmsSigning`.

The role is scoped to these customer-managed KMS keys in `us-east-2`:

- fiscal document signer: `alias/klasse-fiscal-signing`;
- AGT softwareInfo signer: `alias/klasse-agt-software-signing`.

Allowed actions are only `kms:Sign`, `kms:GetPublicKey`, and
`kms:DescribeKey` on those two key ARNs. IAM simulation confirms
`kms:Decrypt` and `kms:ScheduleKeyDeletion` are implicitly denied.

Runtime behavior:

- Vercel uses `VERCEL_OIDC_TOKEN` and the AWS web-identity provider chain;
- no long-lived AWS access key is required;
- if Vercel OIDC is present together with static AWS access-key environment
  variables, signing fails closed with
  `AGT_JWS_STATIC_AWS_CREDENTIALS_FORBIDDEN_ON_VERCEL`;
- `FISCAL_AGT_SOFTWARE_KMS_KEY_REF` remains overrideable by environment, with
  the non-secret managed default
  `kms://us-east-2/alias/klasse-agt-software-signing`;
- the existing taxpayer/document key references
  `kms://us-east-2/alias/klasse-fiscal-signing` now resolve to a real KMS key.

No private-key material is exportable or stored in Supabase/Git/Vercel.

