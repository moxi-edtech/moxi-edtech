# KLASSE — Apply Result
run_id: 1E251454-41E1-4DCD-BCDB-A4ABD2B2B611
timestamp: 2026-07-26T11:02:05Z
approval_commit: bd41ccc59a43a020e0387734efad33828a31f589
status: APPLIED

## Migration

- `supabase/migrations/20270726110500_fix_radar_inadimplencia_authenticated_access.sql`

## Resultado

- Migration aplicada com `ON_ERROR_STOP=1` e `COMMIT` concluído.
- Utilizador autenticado validado com 1.947 linhas, 349 alunos e 15 turmas.
- Linhas devolvidas de outro tenant: 0.
- `anon` com `SELECT` na view: false.
- `authenticated` com `SELECT` directo na MV interna: false.
- `authenticated` com `SELECT` na view pública: true.
- `authenticated` com `EXECUTE` no wrapper: true.
- `service_role` validado com 1.994 linhas em 2 escolas.

## Ajuste de compatibilidade durante o apply

A primeira execução foi revertida pela transação porque a coluna pública
`valor_previsto` usa `numeric(10,2)`. A migration final preserva explicitamente
esse tipo na projeção da view. Nenhuma execução parcial persistiu.

## Meta p95

- Consulta completa do radar: abaixo de 500 ms p95.
- O wrapper executa apenas filtro tenant sobre a MV já materializada.

## Próximos passos

- Executar o fluxo autenticado do widget KLASSE IA.
- Confirmar desambiguação das quatro turmas de 6ª classe.
- Rodar a senha PostgreSQL exposta durante a sessão.
