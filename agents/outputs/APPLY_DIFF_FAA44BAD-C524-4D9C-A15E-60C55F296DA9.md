# KLASSE — Apply Diff
run_id: FAA44BAD-C524-4D9C-A15E-60C55F296DA9
timestamp: 2026-07-18T12:04:45Z
commit_base: dea66ad0

## P0 checklist

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Acção

Registrar a ação acadêmica segura para abrir o acompanhamento de frequência.

## Diff proposto

```diff
--- a/apps/web/src/lib/assistant/actions-v2.ts
+++ b/apps/web/src/lib/assistant/actions-v2.ts
@@
 export const ASSISTANT_ACTIONS_V2: AssistantActionV2Definition[] = [
+  {
+    id: "academico:open_attendance",
+    kind: "open_screen",
+    module: "academico",
+    label: "Rever frequência",
+    description: "Abre o acompanhamento de presenças e faltas.",
+    roles: SECRETARIA_ROLES,
+    riskLevel: "low",
+    requiresApproval: false,
+    permission: "assistant.academico",
+    href: (params) => {
+      const schoolId = stringParam(params, "schoolId");
+      return schoolId ? `/escola/${schoolId}/secretaria/calendario` : undefined;
+    },
+  },
```

## Risco e reversão

Risco baixo: ação somente de navegação para uma rota acadêmica existente.

