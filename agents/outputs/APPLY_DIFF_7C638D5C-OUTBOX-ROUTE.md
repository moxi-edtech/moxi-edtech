# Apply Diff — 7C638D5C-OUTBOX-ROUTE

## Ficheiro
`apps/web/src/app/api/jobs/outbox/route.ts`

## Alteração proposta
- Alinhar o modelo do evento com `event_type` e `next_attempt_at`.
- Marcar sucesso como `sent`, valor válido do enum `outbox_status`.
- Limpar locks e lançar erros de persistência do estado.
- Aceitar `GET` para compatibilidade com Vercel Cron.

## Reversão
Um único `git revert` do commit que incluir esta alteração.
