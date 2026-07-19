# Apply Result — Agent 3
run_id: 117F0376-887D-4CD4-AE28-68F03ACFB47B
status: PASS

## Aplicado

- Migrado o POST do chat de onboarding para `create_onboarding_doubt_by_token`.
- Removidas do POST a resolução direta de `onboarding_requests` e a inserção direta em `onboarding_doubts`.
- Mapeados `onboarding_not_found` para HTTP 404 e `rate_limit_exceeded` para HTTP 429.

## Verificação

- `pnpm typecheck` em `apps/web`: PASS.
- `git diff --check`: PASS.
- POST usa a RPC token-bound: PASS.
- GET permaneceu inalterado: PASS.

## Próximo lote

- Revogar INSERT direto na tabela e substituir/remover `onboarding_doubts_insert_policy WITH CHECK (true)`.
