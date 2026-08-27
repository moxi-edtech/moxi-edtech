# KLASSE — Apply Diff
run_id: 1ECCF7C1-7C9B-48BE-B43A-760AEA71D179
timestamp: 2026-08-01T20:12:38Z
commit_base: 2baa71cc

## P0_CHECKLIST

Todos os itens de `P0_CHECKLIST.md` estão marcados como concluídos.

## Fase

Fase 5 — política final de compatibilidade.

## Diff proposto

```diff
*** Add File: docs/PORTAL_OPERACOES_COMPATIBILIDADE.md
+ Operações definido como portal canónico.
+ Política de redirects e rewrites documentada.
+ Matriz de papéis e autoridade de backend registradas.
+ Estratégia de remoção futura do legado descrita.
```

## Risco e reversão

Risco baixo: documentação apenas.
Reversão: remover o ficheiro.

## Meta de performance

Dashboard <200 ms; redirects limitados a entradas legadas.
