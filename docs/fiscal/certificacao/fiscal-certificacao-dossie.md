# Dossiê de Certificação Fiscal AGT — KLASSE

Data original: 2026-03-26
Última revisão: 2026-09-27
Status: Em consolidação

## Objetivo

Centralizar evidências técnicas e operacionais para submissão e auditoria de certificação fiscal AGT.

## Estado executivo

- Hardening BILL-001–004: concluído.
- Séries AGT (BILL-005): READY FOR HOMOLOGATION; ainda sem série real AGT.
- Facturação Electrónica AGT (BILL-006): implementação assíncrona `registarFactura/obterEstado` em curso; RC depende do BILL-007.
- SAF-T: existe geração e validação XSD, mas a completude semântica/contabilística será revalidada no BILL-008.
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
`apps/web/src/lib/fiscal/xsd/AO_SAFT_1.01.xsd`
`agents/outputs/fiscal/SAFT_XSD_VALIDATION_EVIDENCE_20260326T000801Z.md`

7. Regras visuais AGT em PDF e bloqueio de prévia:
`apps/web/src/app/api/fiscal/documentos/[documentoId]/pdf/route.ts`

8. Infra KMS/IAM:
`docs/fiscal/operacao/aws-fiscal-kms-apply.md`

## Governança e políticas

- Política de rotação/versionamento:
`docs/fiscal/politicas/politica-fiscal-rotacao-versionamento-chaves.md`

- Política de retenção/acesso:
`docs/fiscal/politicas/politica-fiscal-retencao-acesso-ledger.md`

## Checklist operacional de fecho (go-live certificação)

- [ ] Concluir BILL-007 — pagamentos/ledger/RC/sourceDocuments.
- [ ] Concluir BILL-008–012 conforme backlog canónico.
- [ ] Executar BILL-013 — homologação AGT com série real, `registarFactura`, `requestID`, `obterEstado` e V/I.
- [ ] Concluir BILL-014 — governance, retenção, dossiê e procedimento administrativo.
- [ ] Consolidar evidências técnicas e administrativas finais.

## Referências de acompanhamento

- `docs/fiscal/certificacao/backlog-certificacao-agt.md`
- `docs/fiscal/certificacao/agt-go-no-go-checklist.md`
- `docs/fiscal/certificacao/roadmap-fiscal-checklist.md`
- `docs/fiscal/certificacao/backlog-fiscal-fase6-infra-governanca.md`
