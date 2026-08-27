# Apply Diff — Preload financeiro escalonado

run_id: DA956F16-AC8D-45A7-92C2-827B09D89BDD  
data: 2026-08-03  
ficheiro alvo: `apps/web/src/components/financeiro/InstantWorkspaceTabs.tsx`

## Objetivo

Manter switches instantâneos sem iniciar todas as consultas pesadas simultaneamente.

## Diff proposto

```diff
- montar todos os painéis no primeiro render
+ montar primeiro apenas o painel ativo
+ pré-carregar os restantes uma única vez, em segundo plano, após 800 ms
+ manter cada painel montado depois do primeiro carregamento
```

## Risco

Baixo. Alteração apenas do momento de montagem dos painéis.

## Reversão

Restaurar a montagem imediata de todas as abas.
