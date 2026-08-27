# Resultado — coorte assistida e gate financeiro Curtume

data: 2026-08-23
escola: COMPLEXO ESCOLAR PRIVADO ADVETISTA DE CURTUME

## Migrations aplicadas

- `20270823220000_curtume_assisted_transition_cohort`
- `20270823230000_curtume_hold_active_destinations_with_legacy_debt`

## Validação pós-aplicação

| Verificação | Resultado |
|---|---:|
| Coorte `CURTUME_2025_SEM_PAUTAS` ativa | sim |
| Ano origem/destino | 2025 → 2026 |
| Membros elegíveis | 564 |
| Destinos 2026 ativos sem saldo vencido de origem | 233 |
| Destinos 2026 suspensos por saldo vencido de origem | 2 |
| Saldo protegido pelo gate | 27.000 Kz |

Os dois destinos suspensos estão em `pendente`, inativos, e serão ativados pelo
fluxo normal de Balcão somente após a regularização da dívida antiga.
