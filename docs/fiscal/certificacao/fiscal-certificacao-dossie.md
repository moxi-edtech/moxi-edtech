# Dossiê de Certificação Fiscal AGT — KLASSE

Data original: 2026-03-26
Última revisão: 2026-09-27
Status: Em consolidação

## Objetivo

Centralizar evidências técnicas e operacionais para submissão e auditoria de certificação fiscal AGT.

## Estado executivo

- Hardening BILL-001–004: concluído.
- Séries AGT (BILL-005): READY FOR HOMOLOGATION; ainda sem série real AGT.
- Facturação Electrónica AGT (BILL-006): READY FOR HOMOLOGATION; `registarFactura/obterEstado` e RC com `paymentReceipt.sourceDocuments` implementados.
- Pagamentos/ledger/recibos/estornos (BILL-007): CLOSED; alocações fiscais e histórico financeiro append-only validados.
- SAF-T (BILL-008): READY FOR HOMOLOGATION para `TaxAccountingBasis=F`; validação semântica, XSD, TaxTable, RC/sourceDocuments, ordenação e hash dedicado foram endurecidos. `C/I` permanece não suportado sem razão contabilístico real.
- Estado global: NO-GO até concluir os BILLs bloqueantes e obter evidência de homologação externa.

Fonte de verdade do estado:
`docs/fiscal/certificacao/backlog-certificacao-agt.md`.

## Índice de evidências por requisito AGT

1. Assinatura RSA server-side + encadeamento/hash:
`apps/web/src/app/api/fiscal/documentos/route.ts`
`supabase/migrations/20260320000000_fiscal_emitir_documento_atomico.sql`

2. Imutabilidade:
`supabase/migrations/20260319000000_create_fiscal_foundation.sql`
`supabase/migrations/20270324095000_fiscal_rectificar_anular_rpc.sql`

3. Numeração sequencial contínua:
`supabase/migrations/20260319000000_create_fiscal_foundation.sql` (`fiscal_reservar_numero_serie`)

4. Retificação/anulação rastreáveis:
`apps/web/src/app/api/fiscal/documentos/[documentoId]/rectificar/route.ts`
`apps/web/src/app/api/fiscal/documentos/[documentoId]/anular/route.ts`

5. SAF-T operacional:
`apps/web/src/app/api/fiscal/saft/export/route.ts`
`apps/web/src/lib/fiscal/saftAo.ts`

6. Validação XSD automática:
`apps/web/src/lib/fiscal/saftXsdValidator.ts`
`apps/web/src/lib/fiscal/xsd/SAF-T-AO1.01_01.xsd`
`agents/outputs/fiscal/SAFT_XSD_VALIDATION_EVIDENCE_20260326T000801Z.md`

7. Regras visuais AGT em PDF e bloqueio de prévia:
`apps/web/src/app/api/fiscal/documentos/[documentoId]/pdf/route.ts`

8. Infra KMS/IAM:
`docs/fiscal/operacao/aws-fiscal-kms-apply.md`

9. Pagamentos/RC e `sourceDocuments` (BILL-007):
`apps/web/src/lib/fiscal/paymentFiscalDocument.ts`
`apps/web/src/lib/fiscal/agtInvoicePayload.ts`
`supabase/migrations/20260927153607_bill_007_payment_allocations_and_ledger_hardening.sql`
`supabase/migrations/20260927155157_bill_007_fiscal_receipt_sources.sql`

Evidência rollback-only BILL-007: validação duplicada idempotente, overpayment bloqueado, pagamento parcial sem FT/ND bloqueado, RC multi-source, intent settled sem recibo legacy, alocação N:N e reversão idempotente.

10. SAF-T(AO) semântico (BILL-008):
`apps/web/src/lib/fiscal/saftAo.ts`
`apps/web/src/inngest/functions/fiscal-saft-export.ts`
`apps/web/src/lib/fiscal/saftDocumentSigner.ts`
`apps/web/src/lib/fiscal/saftDocumentSignature.ts`
`apps/web/tests/unit/saft-ao-semantic.spec.ts`
`supabase/migrations/20260927171437_bill_008_saft_document_signature_chain.sql`
`supabase/migrations/20260927172749_bill_008_saft_export_evidence_immutability.sql`

Evidência BILL-008:
- 121 documentos históricos pré-validados semanticamente;
- 0 divergências documento x soma de linhas;
- 0 linhas IVA 0 sem código/motivo de isenção;
- 0 documentos anulados sem evento/motivo;
- 0 tipos sem mapeamento;
- 98 documentos comerciais históricos com numeração não-canónica e 8 RC históricos sem sourceDocuments identificados e tratados fail-closed para BILL-010;
- exportações `validated` protegidas contra UPDATE/DELETE;
- cadeia SAF-T validada impedida de iniciar no meio de série histórica;
- Header congelado no pedido de exportação para reprodução determinística;
- SourceID deriva do actor real; ProductType/unidade/perfil fiscal são preservados;
- RC/Payments explicitamente fora da cadeia Hash/HashControl.

## Governança e políticas

- Política de rotação/versionamento:
`docs/fiscal/politicas/politica-fiscal-rotacao-versionamento-chaves.md`

- Política de retenção/acesso:
`docs/fiscal/politicas/politica-fiscal-retencao-acesso-ledger.md`

## Checklist operacional de fecho (go-live certificação)

- [x] Concluir BILL-007 — pagamentos/ledger/RC/sourceDocuments.
- [x] Concluir implementação interna do BILL-008 — SAF-T Facturação `F` semântico/XSD.
- [ ] Concluir BILL-009–012 conforme backlog canónico.
- [ ] Executar BILL-013 — homologação AGT com série real, `registarFactura`, `requestID`, `obterEstado` e V/I.
- [ ] Concluir BILL-014 — governance, retenção, dossiê e procedimento administrativo.
- [ ] Consolidar evidências técnicas e administrativas finais.

## Referências de acompanhamento

- `docs/fiscal/certificacao/backlog-certificacao-agt.md`
- `docs/fiscal/certificacao/agt-go-no-go-checklist.md`
- `docs/fiscal/certificacao/roadmap-fiscal-checklist.md`
- `docs/fiscal/certificacao/backlog-fiscal-fase6-infra-governanca.md`
