# Fiscal Smoke Browser Full — PASS

data: 2026-03-26
ambiente: local (http://localhost:3000)
escola_id: f406f5a7-a077-431c-b118-297224925726
empresa_id: 11a6aba6-3315-4732-a0b1-383202cf4f9d
fonte: execução via DevTools Console (`window.__fiscalSmokeFull`)

## Resultado por etapa

| Etapa | HTTP esperado | HTTP obtido | Resultado |
|---|---|---|---|
| 1 Probe | 200 | 200 | PASS |
| 2 FT padrão | 201 | 201 | PASS |
| 3 FT isenta | 201 | 201 | PASS |
| 4 RC | 201 | 201 | PASS |
| 6 Retificação | 200 | 200 | PASS |
| 7 Anulação | 200 | 200 | PASS |
| 8 PDF | 200 ou 409 | 200 | PASS |
| 9 SAFT | 201 ou 202 | 201 | PASS |

status_global_full: PASS

## Notas

- Séries semânticas FT/FR e RC/RC estavam ativas no momento do teste.
- SAF-T foi executado com período dedicado para evitar conflito de exportação já existente.
