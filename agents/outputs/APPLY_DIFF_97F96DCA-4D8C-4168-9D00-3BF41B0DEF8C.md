# KLASSE — Apply Diff
run_id: 97F96DCA-4D8C-4168-9D00-3BF41B0DEF8C
timestamp: 2026-08-03T00:00:00-03:00

## P0_CHECKLIST

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Ficheiro

`apps/web/src/app/api/secretaria/operacoes-academicas/virada/sessions-target/route.ts`

## Diff proposto

```diff
+ listar templates MED oficiais e publicados posteriores ao ano ativo
+ criar idempotentemente o ano destino como inativo a partir do template escolhido
+ copiar períodos e eventos com escopo obrigatório por escola
+ manter autenticação, autorização e cache no-store
```

## Reversão

Um único `git revert` remove a nova ação; não há execução automática sobre escolas.
