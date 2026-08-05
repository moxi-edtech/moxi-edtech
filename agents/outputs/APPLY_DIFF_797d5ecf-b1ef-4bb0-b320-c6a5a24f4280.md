# Apply diff — sessions-target academic rollover

```diff
--- a/apps/web/src/app/api/secretaria/operacoes-academicas/virada/sessions-target/route.ts
+++ b/apps/web/src/app/api/secretaria/operacoes-academicas/virada/sessions-target/route.ts
@@
-    const primaryTemplate = templateList[0];
+    const primaryTemplate = templateList[0];
+    const targetAcademicYear = activeYear
+      ? Math.max(primaryTemplate.ano_base, activeYear.ano + 1)
+      : primaryTemplate.ano_base;
@@
-      .eq("ano", primaryTemplate.ano_base)
+      .eq("ano", targetAcademicYear)
```
