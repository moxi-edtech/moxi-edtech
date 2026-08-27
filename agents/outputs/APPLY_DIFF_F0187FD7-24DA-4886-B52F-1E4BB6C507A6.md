# KLASSE — Apply Diff
run_id: F0187FD7-24DA-4886-B52F-1E4BB6C507A6
timestamp: 2026-08-03T00:00:00-03:00

## P0_CHECKLIST

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Ficheiro

`apps/web/src/app/escola/[id]/page.tsx`

## Diff proposto

```diff
+ aplicar o mesmo gate ao distribuidor canónico da escola
+ manter aluno fora do fluxo e abrir o wizard para perfis autorizados com ano expirado
```

## Reversão

Um único `git revert` restaura a distribuição anterior por papel.
