# KLASSE — Apply Diff
run_id: 2C196135-FB75-4896-9DE2-1CCFCDC7C75C
timestamp: 2026-07-18T11:50:47Z
commit_base: dea66ad0

## P0 checklist

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Acção

Migrar `finance-debt-by-class.ts` para o contrato e composer comuns, preservando queries canônicas, isolamento por escola e ações existentes.

## Diff proposto

```diff
--- a/apps/web/src/lib/assistant/data-copilot/finance-debt-by-class.ts
+++ b/apps/web/src/lib/assistant/data-copilot/finance-debt-by-class.ts
@@
-type DataCopilotResponse = { ... };
+import { createDataCopilotResponse } from "./answer-composer";
+import type { DataCopilotResponse, DataCopilotTool } from "./types";
@@
-function isDebtByClassQuery(...)
+export function isDebtByClassQuery(...)
@@
-function formatDebtAnswer(...) { ... }
@@
-  const answer = formatDebtAnswer(...);
+  const total = students.reduce(...);
+  const actions = ...;
+  return createDataCopilotResponse({
+    insight: {
+      diagnosis: ...,
+      impact: ...,
+      recommendation: ...,
+      evidence: [...],
+      actions,
+    },
+    links: ...,
+  });
@@
+export const financeDebtByClassTool: DataCopilotTool = {
+  id: "finance-debt-by-class",
+  module: "financeiro",
+  requiredPermission: "assistant.finance",
+  match: isDebtByClassQuery,
+  run: answerFinanceDebtByClass,
+};
```

## Risco e reversão

Risco baixo: as fontes de dados, filtros de tenant e ações não mudam; muda apenas a composição do payload. Reversível com um único `git revert`.

