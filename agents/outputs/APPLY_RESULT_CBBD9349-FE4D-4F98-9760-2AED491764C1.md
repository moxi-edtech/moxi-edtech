# Resultado — KLASSE Fortress v1, lote 7
run_id: CBBD9349-FE4D-4F98-9760-2AED491764C1
approval_commit: 970aa5cef5232a8fb41e7b411caf93dbc22f0969
status: APPLIED

## Ficheiro aplicado
`apps/web/src/app/api/escolas/[id]/cursos/[cursoId]/route.ts`

## Verificações
- P0_CHECKLIST.md sem itens pendentes: PASS
- Diff aplicado idêntico ao diff aprovado: PASS
- Referência ao refresh removida da rota: PASS
- ESLint direcionado com `--max-warnings 0`: PASS

## Efeito
A exclusão de curso deixou de executar refresh global com credenciais do
utilizador. A MV continua atualizada pelo cron backend de 10 minutos.
