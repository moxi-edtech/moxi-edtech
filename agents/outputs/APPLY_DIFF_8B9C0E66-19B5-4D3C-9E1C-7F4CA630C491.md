# Apply diff — Agent 3
run_id: 8B9C0E66-19B5-4D3C-9E1C-7F4CA630C491

## Ficheiro
`apps/web/src/lib/virada/notas-import.ts`

## Alteração aprovada

- Aceitar `avaliacao_id` na importação.
- Exigi-lo para notas numéricas, eliminando resolução ambígua por nome.
- Incorporá-lo na chave idempotente.

## Reversão

Um único `git revert`.
