# Dossiê de Certificação Fiscal AGT — KLASSE

Data: 2026-03-26
Status: Em consolidação

## Objetivo

Centralizar evidências técnicas e operacionais para submissão e auditoria de certificação fiscal AGT.

## Estado executivo

- Base técnica fiscal: implementada.
- Infra KMS/IAM: aplicada.
- Validação XSD SAF-T: implementada com evidência.
- Pendências finais: smoke autenticado E2E, aprovação formal de políticas e fecho administrativo AGT.

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
`agents/outputs/SAFT_XSD_VALIDATION_EVIDENCE_20260326T000801Z.md`

7. Regras visuais AGT em PDF e bloqueio de prévia:
`apps/web/src/app/api/fiscal/documentos/[documentoId]/pdf/route.ts`

8. Infra KMS/IAM:
`docs/academico/aws-fiscal-kms-apply.md`

## Governança e políticas

- Política de rotação/versionamento:
`docs/academico/politica-fiscal-rotacao-versionamento-chaves.md`

- Política de retenção/acesso:
`docs/academico/politica-fiscal-retencao-acesso-ledger.md`

## Checklist operacional de fecho (go-live certificação)

- [ ] Executar smoke test autenticado E2E e anexar output.
- [ ] Aprovar formalmente políticas de rotação e retenção.
- [ ] Consolidar comprovativos administrativos AGT (Modelo 8 + chave `.txt`).

## Referências de acompanhamento

- `docs/academico/agt-go-no-go-checklist.md`
- `docs/academico/roadmap-fiscal-checklist.md`
- `docs/academico/backlog-fiscal-fase6-infra-governanca.md`
