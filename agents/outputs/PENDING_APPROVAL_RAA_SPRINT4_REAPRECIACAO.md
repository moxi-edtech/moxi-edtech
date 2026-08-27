# Aprovação necessária — Agent 3
run_id:    RAA-SPRINT4-REAPRECIACAO-20260815
timestamp: 2026-08-15

Estado: APPROVED — migration aplicada e validada em 2026-08-15.

## Acção proposta

Criar `public.reapreciacao_pedidos` para persistir pedidos RAA com protocolo, prazo de 48 horas, estado auditável, RLS por escola e idempotência.

## Diff

Migration proposta: `supabase/migrations/20260815190000_raa_reapreciacao_pedidos.sql`

Inclui:

- contexto obrigatório de escola, ano letivo, turma, matrícula e disciplina;
- `protocolo_publico` único por escola;
- `prazo_em` obrigatório;
- `idempotency_key` única por escola;
- índice único para impedir dois pedidos pendentes no mesmo contexto;
- RLS via `user_can_access_raa_school`.

## Risco

É uma alteração de schema e persistência de dados académicos oficiais. Não deve ser aplicada sem aprovação explícita.

## Como aprovar

Commit com mensagem: `APPROVE: RAA-SPRINT4-REAPRECIACAO-20260815`

## Como rejeitar

Commit com mensagem: `REJECT: RAA-SPRINT4-REAPRECIACAO-20260815 [motivo]`
