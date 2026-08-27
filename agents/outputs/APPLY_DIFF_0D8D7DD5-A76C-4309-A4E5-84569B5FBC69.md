# KLASSE — Apply Diff
run_id: 0D8D7DD5-A76C-4309-A4E5-84569B5FBC69
timestamp: 2026-08-01T12:53:14Z
commit_base: 2baa71cc

## P0_CHECKLIST

Todos os itens de `P0_CHECKLIST.md` estão marcados como concluídos.

## Fase

Portal Operações — Fase 4: links financeiros contextuais.

## Diff proposto

```diff
*** Update File: apps/web/src/lib/navigation.ts
- Mapeamentos financeiros parciais para Recebimentos.
+ Mapeamento integral `/financeiro/**` → `/operacoes/financeiro/**`.
+ Subpaths e query strings preservados.
```

## Risco e reversão

Risco baixo/moderado: muda destinos apenas quando o utilizador já está em Operações.
Reversão: um único `git revert`.

## Meta de performance

Transformação local constante, sem round-trip.
