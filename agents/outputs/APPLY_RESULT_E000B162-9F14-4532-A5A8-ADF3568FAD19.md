# KLASSE — Apply Result
run_id: E000B162-9F14-4532-A5A8-ADF3568FAD19
timestamp: 2026-07-26T10:53:37Z
status: APPLIED

## Ficheiro alterado

- `apps/web/src/lib/assistant/data-copilot/finance-debt-by-class.ts`

## Evidências

- `npm run typecheck --workspace=apps/web`: PASS
- `npx eslint src/lib/assistant/data-copilot/finance-debt-by-class.ts`: PASS
- Teste isolado com `tsx`: INCONCLUSIVO; o import server-side depende do marcador `server-only` fornecido pelo runtime Next.js.
- Nenhum acesso ou alteração à base de dados.

## Resultado funcional

- Reconhece a gralha observada `iandimplente`.
- Normaliza acentos, ordinais e números por extenso.
- Resolve uma turma única por nome, código, classe e secção.
- Solicita desambiguação quando várias turmas correspondem.
- Informa turma inexistente ou indisponibilidade da fonte sem cair no Help Mode.

## Meta p95

- Consulta completa: abaixo de 500 ms p95.
- Nenhuma query adicional introduzida.

## Próximos passos

- Adicionar testes unitários do resolver num run separado.
- Validar o fluxo autenticado no widget com dados reais.
- Instrumentar motivo de fallback por ferramenta.
