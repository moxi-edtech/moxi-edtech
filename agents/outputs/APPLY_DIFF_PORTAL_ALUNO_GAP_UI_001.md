# Diff aplicado — GAP-UI-001

run_id: PORTAL-ALUNO-GAP-UI-001-20260604
status: APPLIED

## Escopo

Consolidar os dois componentes `RematriculaBanner` do portal do aluno.

## Problema

Existiam duas implementações independentes:

- `apps/web/src/components/aluno/home/RematriculaBanner.tsx`
- `apps/web/src/components/aluno/dashboard/RematriculaBanner.tsx`

As duas chamavam os mesmos endpoints, mas tinham comportamento divergente para dívida, atualização pós-confirmação, UI e tratamento de erro.

## Alterações

- `apps/web/src/components/aluno/home/RematriculaBanner.tsx`
  - Mantido como implementação canônica.
  - `fetch('/api/aluno/rematricula/status')` agora usa `cache: 'no-store'`.
  - Trata payload inválido/erro como `status=null`.
  - Remove imports não usados.
  - Catch tipado como `unknown`.

- `apps/web/src/components/aluno/dashboard/RematriculaBanner.tsx`
  - Substituído por re-export:
    `export { RematriculaBanner } from "@/components/aluno/home/RematriculaBanner";`

## Validação

- `pnpm -C apps/web typecheck`: PASS
- `pnpm -C apps/web exec eslint src/components/aluno/home/RematriculaBanner.tsx src/components/aluno/dashboard/RematriculaBanner.tsx --max-warnings 10000`: PASS
