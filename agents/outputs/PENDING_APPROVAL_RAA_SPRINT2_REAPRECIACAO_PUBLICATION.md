# Aprovação necessária — Agent 3
run_id:    RAA-SPRINT2-REAPRECIACAO-PUBLICATION-20260815
timestamp: 2026-08-15T00:00:00-03:00

## Acção proposta

Aplicar `supabase/migrations/20260816013000_raa_reapreciacao_publication_source.sql` para persistir a publicação oficial que originou o prazo de 48 horas da reapreciação.

## Diff

```sql
ALTER TABLE public.reapreciacao_pedidos
  ADD COLUMN IF NOT EXISTS resultado_publicado_em timestamptz;
```

## Risco

Alteração aditiva e não destrutiva em tabela de workflow RAA. Permite rastrear a fonte temporal do prazo regulamentar.

## Como aprovar

Commit com mensagem: `APPROVE: RAA-SPRINT2-REAPRECIACAO-PUBLICATION-20260815`

## Como rejeitar

Commit com mensagem: `REJECT: RAA-SPRINT2-REAPRECIACAO-PUBLICATION-20260815 [motivo]`
