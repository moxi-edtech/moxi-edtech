# Resultado — normalização de estados Curtume 2025

data: 2026-08-23
escola: COMPLEXO ESCOLAR PRIVADO ADVETISTA DE CURTUME
identificador: complexo-escolar-privado-advetista-de-curtume

## Alteração aplicada

Foram normalizadas 564 matrículas de origem do ano lectivo de 2025 que não possuíam resultado académico final registado:

- `status`: `pendente`
- `ativo`: `false`
- `motivo_fecho`: `Aguardando decisão académica individual — Virada assistida Curtume 2025/2026`
- `data_fecho`: `null`

Não foram criados resultados académicos, nem alteradas matrículas de destino de 2026.

## Validação pós-aplicação

| Verificação | Resultado |
|---|---:|
| Origens Curtume 2025 pendentes/inactivas | 564 |
| Destinos Curtume 2026 activos | 235 |
| Resultados finais 2025 fabricados | 0 |
| Auditoria `ativo → pendente` | 329 |
| Auditoria `transferido → pendente` | 235 |

## Efeito operacional

O balcão passa a tratar cada aluno de 2025 como origem pendente de decisão. A decisão individual registará o resultado histórico e concluirá a origem; qualquer destino 2026 já activo permanece preservado.
