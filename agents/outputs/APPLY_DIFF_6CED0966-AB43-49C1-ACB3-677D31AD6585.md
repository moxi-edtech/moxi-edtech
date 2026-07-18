# KLASSE — Apply Diff
run_id: 6CED0966-AB43-49C1-ACB3-677D31AD6585
timestamp: 2026-07-18T12:04:31Z
commit_base: dea66ad0

## P0 checklist

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Acção

Adicionar permissão explícita para diagnósticos acadêmicos do Data Copilot.

## Diff proposto

```diff
--- a/apps/web/src/lib/assistant/permission-registry.ts
+++ b/apps/web/src/lib/assistant/permission-registry.ts
@@
   {
+    key: "assistant.academico",
+    roles: SECRETARIA_AND_UP,
+    description: "Permite consultar diagnósticos acadêmicos de notas e frequência.",
+  },
+  {
     key: "assistant.secretaria",
```

## Risco e reversão

Risco baixo: restringe a capacidade aos perfis administrativos acadêmicos já reconhecidos.

