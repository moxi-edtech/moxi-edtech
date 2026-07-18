# KLASSE — Apply Diff
run_id: 05D3AFA7-93FC-44C2-9D77-983A986EA3FE
timestamp: 2026-07-18T11:57:19Z
commit_base: dea66ad0

## P0 checklist

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Acção

Criar o registry executável e fechado do Data Copilot, com autorização antes de match e execução.

## Diff proposto

```diff
diff --git a/apps/web/src/lib/assistant/data-copilot/tool-registry.ts b/apps/web/src/lib/assistant/data-copilot/tool-registry.ts
new file mode 100644
--- /dev/null
+++ b/apps/web/src/lib/assistant/data-copilot/tool-registry.ts
@@
+import { hasAssistantPermission } from "../permission-registry";
+import { financeDebtByClassTool } from "./finance-debt-by-class";
+import type { DataCopilotResponse, DataCopilotTool, ToolRunParams } from "./types";
+
+const DATA_COPILOT_TOOLS: readonly DataCopilotTool[] = [financeDebtByClassTool];
+
+export function getDataCopilotTools() {
+  return DATA_COPILOT_TOOLS;
+}
+
+export async function runDataCopilotTool(
+  params: ToolRunParams,
+): Promise<DataCopilotResponse | null> {
+  const normalizedQuery = params.query.trim().toLowerCase();
+
+  for (const tool of DATA_COPILOT_TOOLS) {
+    if (!hasAssistantPermission(params.role, tool.requiredPermission)) continue;
+    if (!tool.match(normalizedQuery, params.context)) continue;
+
+    const response = await tool.run(params);
+    if (response) return response;
+  }
+
+  return null;
+}
```

## Risco e reversão

Risco baixo: o registry contém apenas a ferramenta financeira já existente e não altera o runtime até ser ligado ao brain. Reversível removendo o ficheiro.

