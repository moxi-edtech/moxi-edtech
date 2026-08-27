# KLASSE — Apply Diff
run_id: A9B614B2-CB78-44CA-AE03-B60DB7FCC157
timestamp: 2026-07-26T11:19:46Z
ficheiro: apps/web/src/lib/assistant/actions-v2.ts

## P0_CHECKLIST

Todos os itens estão marcados como concluídos (`[x]`).

## Diff proposto

```diff
 const FINANCE_ROLES = [
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

Alteração isolada num único ficheiro, reversível num único `git revert`.

## Meta p95

Sem impacto de performance; apenas corrige visibilidade de ações já autorizadas.
