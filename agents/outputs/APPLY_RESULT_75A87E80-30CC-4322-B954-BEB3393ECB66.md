# Resultado — KLASSE Fortress v1, lote 8
run_id: 75A87E80-30CC-4322-B954-BEB3393ECB66
approval_commit: b4f9c2babb5aa17bcb021b73e027e71e9703d2c9
status: APPLIED

## Ficheiro aplicado
`apps/web/src/app/api/escolas/[id]/cursos/route.ts`

## Verificações
- P0_CHECKLIST.md sem itens pendentes: PASS
- Diff aplicado idêntico ao diff aprovado: PASS
- Referência ao refresh removida da rota: PASS
- ESLint direcionado com `--max-warnings 0`: PASS

## Efeito
A criação de curso deixou de executar refresh global com credenciais do
utilizador. Criação, resposta e notificação financeira permanecem intactas; a
MV continua atualizada pelo cron backend de 10 minutos.
