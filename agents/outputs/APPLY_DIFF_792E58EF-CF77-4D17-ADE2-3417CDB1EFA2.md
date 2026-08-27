# Apply Diff — Testar dez acessos financeiros

run_id: 792E58EF-CF77-4D17-ADE2-3417CDB1EFA2  
data: 2026-08-02  
ficheiro alvo: `apps/web/tests/unit/operacoes-access-and-navigation.spec.ts`

## Objetivo

Fixar em teste as dez entradas financeiras operacionais aprovadas.

## Diff proposto

```diff
-    { href: "/escola/[escolaId]/operacoes/recebimentos", label: "Caixa e pagamentos" },
+    { href: "/escola/[escolaId]/operacoes/recebimentos", label: "Caixa e recebimentos" },
+    { href: "/escola/[escolaId]/operacoes/financeiro/pagamentos", label: "Pagamentos" },
+    { href: "/escola/[escolaId]/operacoes/financeiro/conciliacao", label: "Conciliação" },
+    { href: "/escola/[escolaId]/operacoes/financeiro/fecho", label: "Fecho de caixa" },
```

## Risco

Baixo. Alteração somente de expectativa automatizada.

## Reversão

Restaurar a lista anterior do teste.
