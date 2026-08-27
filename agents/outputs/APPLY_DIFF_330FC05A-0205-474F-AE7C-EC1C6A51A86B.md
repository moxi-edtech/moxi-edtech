# KLASSE — Apply Diff
run_id: 330FC05A-0205-474F-AE7C-EC1C6A51A86B
timestamp: 2026-07-26T11:22:32Z
ficheiro: apps/web/src/lib/roles/ai-roles.ts

## P0_CHECKLIST

Todos os itens estão concluídos.

## Diff proposto

```diff
 export const AI_ACTIONS_FINANCE_ROLES = [
   "admin",
   "admin_escola",
+  "staff_admin",
   "direcao",
   "diretoria",
+  "secretaria",
   "financeiro",
   "admin_financeiro",
   "secretaria_financeiro",
 ];
```

## Reversibilidade

Alteração isolada e reversível num único `git revert`.

## Meta p95

Sem impacto de performance.
