# KLASSE — Apply Result
run_id: 0D8D7DD5-A76C-4309-A4E5-84569B5FBC69
status: PASS

## Alteração

Links gerados por telas financeiras, quando abertas em Operações, agora são
normalizados integralmente para `/operacoes/financeiro/**`.

## Evidências

- `P0_CHECKLIST.md`: PASS.
- `pnpm --filter web typecheck`: PASS.
- ESLint direcionado com `--max-warnings 0`: PASS.
- `git diff --check`: PASS.
- Subpaths e query strings são preservados pelo helper existente.

## Meta p95

Transformação local constante.
