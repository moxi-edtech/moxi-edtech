# Aprovação necessária — Agent 3
run_id:    303726FB-2705-4AAC-B376-0D4234BF3B36
timestamp: 2026-08-15T00:00:00-03:00

## Acção proposta

Aplicar a migration `supabase/migrations/20260816010000_raa_decreto_sql_ssot.sql` no banco da Escola Klasse. A migration preserva o resolvedor anterior como `resolve_raa_progression_for_matricula_generic`, cria `resolve_raa_decreto_for_matricula` e faz o contrato público transacional consultar primeiro as regras jurídicas dos arts. 23.º, 26.º e 33.º.

## Diff

```text
Arquivo novo: supabase/migrations/20260816010000_raa_decreto_sql_ssot.sql

BEGIN;
ALTER FUNCTION public.resolve_raa_progression_for_matricula(uuid, uuid)
  RENAME TO resolve_raa_progression_for_matricula_generic;
CREATE OR REPLACE FUNCTION public.resolve_raa_decreto_for_matricula(uuid, uuid)
  RETURNS jsonb ...;
CREATE OR REPLACE FUNCTION public.resolve_raa_progression_for_matricula(uuid, uuid)
  RETURNS jsonb ... chama resolve_raa_decreto_for_matricula e usa o contrato generic como fallback;
REVOKE/GRANT dos dois contratos;
COMMIT;
```

Diff completo: `supabase/migrations/20260816010000_raa_decreto_sql_ssot.sql`.

## Risco

A migration altera o contrato efetivamente usado por promoção, balcão e rematrícula em massa. Um erro de classificação curricular, nota ou combinação legal pode bloquear uma operação ou permitir uma decisão incorreta. A alteração é reversível por um único `git revert` e deve ser aplicada primeiro em ambiente de validação.

## Como aprovar

Commit com mensagem: `APPROVE: 303726FB-2705-4AAC-B376-0D4234BF3B36`

## Como rejeitar

Commit com mensagem: `REJECT: 303726FB-2705-4AAC-B376-0D4234BF3B36 [motivo]`
