# Apply Diff — Teste da navegação financeira consolidada

run_id: BD4E1D98-74AF-495D-9EA7-DB5CF2BF3C83  
data: 2026-08-02  
ficheiro alvo: `apps/web/tests/unit/operacoes-access-and-navigation.spec.ts`

## Objetivo

Fixar no contrato de navegação os workspaces Recebimentos e Controlo de caixa.

## Diff proposto

```diff
- quatro destinos de recebimento, pagamento, conciliação e fecho
+ dois destinos consolidados
```

## Risco

Baixo. Atualização da expectativa à decisão de UX aprovada.

## Reversão

Restaurar as quatro expectativas anteriores.
