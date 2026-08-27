# KLASSE — Apply Diff
run_id: B673368A-C068-4F6C-859D-8CD05FFC9C40
timestamp: 2026-07-26T11:22:51Z
ficheiro: apps/web/src/lib/assistant/permission-registry.ts

## P0_CHECKLIST

Todos os itens estão concluídos.

## Alteração proposta

```diff
+ importar os grupos canónicos de `@/lib/roles/ai-roles`
- remover quatro listas locais duplicadas
```

## Reversibilidade

Alteração isolada e reversível num único `git revert`.

## Meta p95

Sem impacto de performance.
