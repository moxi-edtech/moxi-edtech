# KLASSE — Apply Diff
run_id: AF9ABA42-0C03-481A-A1A4-6EF1B4385B1B
timestamp: 2026-08-23T13:50:08Z

## P0_CHECKLIST

Todos os itens de `P0_CHECKLIST.md` estão em PASS.

## Alteração proposta

Substituir o stepper genérico de três passos por um percurso contextual de seis etapas alinhado ao trabalho real do administrador: dados, RAA, fecho, reservas, destinos e activação final.

## Diff resumido

```diff
- Preparar → Exceções → Confirmar
+ 1 Dados de 2025
+ 2 Decisão RAA
+ 3 Fechar 2025
+ 4 Reservas 2026
+ 5 Turmas destino
+ 6 Activação final
```

## Reversão

Reversível num único `git revert` do commit correspondente.
