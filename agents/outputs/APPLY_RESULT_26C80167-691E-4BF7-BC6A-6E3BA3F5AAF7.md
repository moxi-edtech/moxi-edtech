# KLASSE — Apply Result
run_id: 26C80167-691E-4BF7-BC6A-6E3BA3F5AAF7
timestamp: 2026-07-26T11:18:25Z
status: APPLIED

## Ficheiro alterado

- `apps/web/src/lib/assistant/klasse-brain.ts`

## Resultado funcional

- Fallbacks deixaram de devolver sugestões e ações recursivas.
- Respostas `Não encontrei essa informação...` são detectadas com ou sem acentos.
- Falta de permissão usa `fallbackReason: permission_denied`.
- Ausência de resposta segura usa `fallbackReason: knowledge_not_found`.
- Indisponibilidade do provider usa `fallbackReason: provider_unavailable`.

## Validação

- `npm run typecheck --workspace=apps/web`: PASS.
- ESLint do ficheiro: PASS com 3 warnings preexistentes e 0 erros.
- `git diff --check`: PASS.

## Meta p95

- Sem regressão esperada.
- O fallback executa menos trabalho e devolve payload menor.

## Próximos passos

- Harmonizar as listas duplicadas de permissões.
- Extrair o resolver comum de intenção e entidades.
- Adicionar testes unitários e E2E do fluxo de fallback.
