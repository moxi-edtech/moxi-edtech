# KLASSE — Apply Diff
run_id: 68D78AE8-438A-409D-A3B9-F483680D0CDE
timestamp: 2026-07-18T12:02:52Z
commit_base: dea66ad0

## P0 checklist

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Acção

Registrar `admissions-pending` no Data Copilot produtivo.

## Diff proposto

```diff
--- a/apps/web/src/lib/assistant/data-copilot/tool-registry.ts
+++ b/apps/web/src/lib/assistant/data-copilot/tool-registry.ts
@@
 import { financeDebtByClassTool } from "./finance-debt-by-class";
+import { admissionsPendingTool } from "./tools/admissions-pending";
@@
-const DATA_COPILOT_TOOLS: readonly DataCopilotTool[] = [financeDebtByClassTool];
+const DATA_COPILOT_TOOLS: readonly DataCopilotTool[] = [
+  financeDebtByClassTool,
+  admissionsPendingTool,
+];
```

## Risco e reversão

Risco baixo: adiciona uma ferramenta de leitura com intenção e permissão específicas, sem alterar a ferramenta financeira.

