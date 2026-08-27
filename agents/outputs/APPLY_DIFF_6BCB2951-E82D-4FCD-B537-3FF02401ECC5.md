# KLASSE — Apply Diff
run_id: 6BCB2951-E82D-4FCD-B537-3FF02401ECC5
timestamp: 2026-08-03T00:00:00-03:00

## P0_CHECKLIST

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Ficheiro

`apps/web/src/lib/operacoes-academicas/academic-year-rollover-gate.ts`

## Diff proposto

```diff
+ adicionar detector server-side, tenant-scoped, de ano letivo ativo expirado
+ usar data civil de Africa/Luanda e comparação ISO YYYY-MM-DD
+ limitar o encaminhamento automático a perfis com responsabilidade de configuração
+ falhar aberto em erro de leitura para não bloquear o login
```

## Reversão

Um único `git revert` remove o helper sem alterar dados reais ou schema.
