# KLASSE — Apply Diff
run_id: 5D40D5DA-DE27-4BA9-A549-5577EE4B21FC
timestamp: 2026-08-01T12:54:52Z
commit_base: 2baa71cc

## P0_CHECKLIST

Todos os itens de `P0_CHECKLIST.md` estão marcados como concluídos.

## Fase

Portal Operações — Fase 4: preservar contexto na home financeira.

## Diff proposto

```diff
*** Update File: apps/web/next.config.ts
- Home operacional resolvida via rota financeira que redireciona.
+ Home e dashboards resolvidos diretamente na página financeira raiz.
+ URL `/operacoes/financeiro/**` permanece estável.
```

## Risco e reversão

Risco baixo: especializa dois paths antes do rewrite genérico.
Reversão: um único `git revert`.

## Meta de performance

Remove um redirect; melhora a navegação em um round-trip.
