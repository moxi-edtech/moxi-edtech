# Apply diff — Agent 3
run_id: 0FE4F7A5-A4FA-463D-B4F9-96518FD9ED8C

## Ficheiro
`apps/web/src/app/api/secretaria/operacoes-academicas/virada/dry-run/route.ts`

## Alteração proposta

- Incluir no dry-run a existência do ano de destino.
- Bloquear a execução quando não houver destino futuro.
- Expor templates oficiais disponíveis e lotes de notas aprovados ainda não aplicados.
- Falhar de forma segura quando qualquer consulta de readiness falhar.

## Reversão

Um único `git revert` do commit que incluir esta alteração.
