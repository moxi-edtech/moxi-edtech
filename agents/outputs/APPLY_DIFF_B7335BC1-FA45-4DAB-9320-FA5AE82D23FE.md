# Diff: ajustar retorno do contexto financeiro

```diff
*** Update File: apps/web/src/app/api/migracao/alunos/importar/route.ts
@@
-}): Promise<number> {
+}): Promise<FinanceContextResult> {
@@
-  if (!alunoIds.length) return 0;
+  if (!alunoIds.length) return { activeMatriculas: 0, pendencias: [] };
```
