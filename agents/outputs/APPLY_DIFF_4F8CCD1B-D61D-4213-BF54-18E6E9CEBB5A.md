# KLASSE — Apply Diff
run_id: 4F8CCD1B-D61D-4213-BF54-18E6E9CEBB5A
timestamp: 2026-08-03T00:00:00-03:00

## P0_CHECKLIST

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Ficheiro

`apps/web/src/components/secretaria/virada-ano/ConfigStep.tsx`

## Diff proposto

```diff
+ selecionar automaticamente o primeiro ano futuro disponível
+ pré-visualizar o reajuste automaticamente com debounce
+ eliminar o clique separado de pré-visualização
+ guardar o destino sem saltar fases e comunicar conclusão ao wizard
+ usar linguagem genérica para qualquer escola K12
```

## Reversão

Um único `git revert` restaura o formulário anterior sem alterar schema.
