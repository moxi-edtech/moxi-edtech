# Apply Diff — Histórico transitado

run_id: HISTORICO-TRANSITADO-20260810
timestamp: 2026-08-10

## Migration aplicada

`supabase/migrations/20270618100000_historico_transitado_foundation.sql`

## Efeito esperado

- Criar `public.historico_transitado_anos`.
- Criar `public.historico_transitado_notas`.
- Criar índices e políticas RLS.
- Criar `public.upsert_historico_transitado(...)`.
- Adicionar compatibilidade aos dados existentes de `historico_anos` e `historico_disciplinas`.

## Segurança

- Operação aditiva e transacional.
- Não remove tabelas, colunas ou dados.
- Não altera dados de alunos ou matrículas.
- P0_CHECKLIST.md verificado: todos os itens PASS.
