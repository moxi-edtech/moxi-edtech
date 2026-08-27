# Apply diff — Agent 3
run_id: 6C4A4E35-0B9D-4DD5-96D8-96CC369D64AA

## Ficheiro
`apps/web/src/app/api/secretaria/operacoes-academicas/virada/notas/stage/route.ts`

## Alteração proposta

- Resolver `matricula_id` e `aluno_id` dentro do próprio staging.
- Exigir matrícula única da escola e do ano informado.
- Persistir correspondências no lote e bloquear aprovação de linhas sem correspondência.

## Reversão

Um único `git revert` do commit que incluir esta alteração.
