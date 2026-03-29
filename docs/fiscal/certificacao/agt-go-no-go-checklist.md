# AGT — Go/No-Go Checklist (Certificação Fiscal)

Data: 2026-03-26
Status global: **NO-GO**
Pack de execução: `docs/fiscal/certificacao/agt-certification-go-live-pack.md`

## Como ler este checklist

- `[x]` concluído com evidência técnica.
- `[ ]` pendente (bloqueia submissão AGT quando em P0/P1).

## Critério de GO

- Todos os itens de `P0` e `P1` em `[x]`.
- Evidências rastreáveis em docs/outputs.
- Procedimento administrativo AGT concluído (Modelo 8 + chave pública `.txt`).

## P0 — Requisitos técnicos AGT (bloqueante)

- [x] Assinatura RSA server-side com `hash_control`, `key_version` e encadeamento.
  Evidência: `apps/web/src/app/api/fiscal/documentos/route.ts`, `supabase/migrations/20260320000000_fiscal_emitir_documento_atomico.sql`.

- [x] Imutabilidade de documentos fiscais assinados.
  Evidência: `supabase/migrations/20270324095000_fiscal_rectificar_anular_rpc.sql`, `supabase/migrations/20260319000000_create_fiscal_foundation.sql`.

- [x] Numeração sequencial contínua por série (concorrência).
  Evidência: `fiscal_reservar_numero_serie` com `FOR UPDATE` em `supabase/migrations/20260319000000_create_fiscal_foundation.sql`.

- [x] Rastreabilidade de retificações e anulações.
  Evidência: `apps/web/src/app/api/fiscal/documentos/[documentoId]/rectificar/route.ts`, `apps/web/src/app/api/fiscal/documentos/[documentoId]/anular/route.ts`.

- [x] Exportação SAF-T(AO) operacional.
  Evidência: `apps/web/src/app/api/fiscal/saft/export/route.ts`, `apps/web/src/lib/fiscal/saftAo.ts`.

- [x] Validação automática SAF-T contra XSD oficial com evidência de execução.
  Evidência: `apps/web/src/lib/fiscal/saftXsdValidator.ts`, `apps/web/src/lib/fiscal/xsd/SAF-T-AO1.01_01.xsd`, `agents/outputs/fiscal/SAFT_XSD_OFICIAL_EVIDENCIA_20260326.md`.

- [x] Regras visuais AGT no PDF fiscal (menção AGT, 4 chars da assinatura, frase para não-fatura).
  Evidência: `apps/web/src/app/api/fiscal/documentos/[documentoId]/pdf/route.ts`.

- [x] Bloqueio de prévia/impressão fiscal antes da assinatura.
  Evidência: `409 FISCAL_PREVIEW_NOT_ALLOWED` em `apps/web/src/app/api/fiscal/documentos/[documentoId]/pdf/route.ts`.

- [x] Smoke test autenticado E2E (`probe`, emissão FT padrão/isenta, emissão RC, retificação, anulação, PDF, exportação).
  Evidência: `agents/outputs/fiscal/FISCAL_SMOKE_BROWSER_FULL_PASS_20260326.md`.

## P1 — Governança (bloqueante para submissão)

- [x] Política publicada de rotação/versionamento de chaves (com rollback).
  Evidência: `docs/fiscal/politicas/politica-fiscal-rotacao-versionamento-chaves.md`.

- [ ] Política aprovada de retenção/acesso ao ledger fiscal.
  Evidência disponível: `docs/fiscal/politicas/politica-fiscal-retencao-acesso-ledger.md` (publicada, pendente aprovação formal).

- [x] Dossiê de evidências técnicas consolidado para auditoria.
  Evidência: `docs/fiscal/certificacao/fiscal-certificacao-dossie.md`.

## P2 — Administrativo AGT (fecho de submissão)

- [ ] Processo AGT concluído (Declaração Modelo 8 + upload da chave pública `.txt`).
  Evidência esperada: comprovativo de submissão.

## Próximos passos imediatos

1. Aprovar formalmente política de retenção/acesso ao ledger (P1).
2. Encerrar submissão administrativa AGT (P2).
