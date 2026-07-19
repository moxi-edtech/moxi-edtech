# Apply Diff — Agent 3
run_id: 117F0376-887D-4CD4-AE28-68F03ACFB47B
timestamp: 2026-07-18T00:00:00-03:00

## Ficheiro

`apps/web/src/app/api/onboarding/acompanhar/[token]/help/route.ts`

## Alteração proposta

```diff
- consultar `onboarding_requests` e inserir diretamente em `onboarding_doubts`
+ chamar `create_onboarding_doubt_by_token`
+ responder 404 para `onboarding_not_found`
+ responder 429 para `rate_limit_exceeded`
```

## Risco

Limitado ao POST do chat público; o GET e a policy existente permanecem inalterados neste run.
