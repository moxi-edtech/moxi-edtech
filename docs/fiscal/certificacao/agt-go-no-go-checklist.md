# AGT — Go/No-Go Checklist (Certificação Fiscal)

Data: 2026-09-27
Status global: **NO-GO**
Backlog canónico: `docs/fiscal/certificacao/backlog-certificacao-agt.md`
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

## Estado técnico actualizado — 2026-09-27

A auditoria de certificação de setembro reabriu requisitos que este checklist histórico tratava como encerrados apenas com base na implementação local.

- BILL-001 a BILL-004: CLOSED.
- BILL-005: READY FOR HOMOLOGATION — falta série real AGT.
- BILL-006: READY FOR HOMOLOGATION — `registarFactura/obterEstado` + RC/`paymentReceipt.sourceDocuments` implementados; falta prova externa AGT.
- BILL-007: CLOSED — pagamentos canónicos, ledger/estornos append-only, alocações fiscais e RC rastreável concluídos.
- BILL-008: READY FOR HOMOLOGATION — SAF-T Facturação `F` validado semanticamente + XSD; SAF-T contabilístico `C/I` não é declarado porque não existe razão de dupla entrada no KLASSE.
- O estado detalhado, critérios de fecho e próximos backlogs estão em `backlog-certificacao-agt.md`.

Os itens marcados `[x]` acima comprovam a capacidade local indicada, mas **não substituem homologação AGT** quando o requisito depende de serviço externo.

## Próximos passos imediatos

1. Executar BILL-009 — motor fiscal/IVA e arredondamentos.
2. Executar BILL-010 — ciclo documental e tratamento dos dados fiscais históricos incompatíveis.
3. Seguir a ordem definida no backlog canónico até BILL-014.

Nota: reversão de pagamento já fiscalizado permanece fail-closed até anulação/correcção do documento no BILL-010.
