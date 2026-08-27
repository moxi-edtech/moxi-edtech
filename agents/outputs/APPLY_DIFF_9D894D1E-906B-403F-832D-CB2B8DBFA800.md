# Apply Diff — Risco exige saldo vencido

run_id: 9D894D1E-906B-403F-832D-CB2B8DBFA800  
data: 2026-08-02  
ficheiro alvo: `supabase/migrations/20270802090000_create_financeiro_carteira_alunos_mv.sql`

## Objetivo

Garantir que dias de atraso e risco só sejam calculados para mensalidade vencida com saldo positivo.

## Diff proposto

```diff
         WHEN mensalidade.status IN ('pendente', 'pago_parcial')
           AND mensalidade.data_vencimento < CURRENT_DATE
+          AND GREATEST(mensalidade.valor_previsto - mensalidade.valor_pago, 0) > 0
```

## Risco

Baixo. Corrige falso risco sem alterar valores em aberto ou pagos.

## Reversão

Remover a condição de saldo positivo.
