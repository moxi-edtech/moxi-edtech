# KLASSE — Apply Diff
run_id: 77A157EC-934C-4BAC-BA5F-BA17D6FC7F57
timestamp: 2026-07-18T11:49:23Z
commit_base: dea66ad0

## P0 checklist

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Acção

Criar o contrato tipado comum do Data Copilot, sem alterar comportamento em runtime.

## Diff proposto

```diff
diff --git a/apps/web/src/lib/assistant/data-copilot/types.ts b/apps/web/src/lib/assistant/data-copilot/types.ts
new file mode 100644
--- /dev/null
+++ b/apps/web/src/lib/assistant/data-copilot/types.ts
@@
+import type { AssistantActionV2 } from "../actions-v2";
+import type { AiWidgetContext } from "../screen-context";
+
+export type DataCopilotModule = "financeiro" | "secretaria" | "academico" | "direcao";
+
+export type AssistantOperatingMode = "help" | "data" | "action";
+
+export type InsightEvidence = {
+  label: string;
+  value: string;
+};
+
+export type InsightAnswer = {
+  diagnosis: string;
+  impact: string;
+  recommendation: string;
+  evidence: InsightEvidence[];
+  actions: AssistantActionV2[];
+};
+
+export type DataCopilotResponse = {
+  ok: true;
+  mode: "data_query";
+  operatingMode: "data";
+  answer: string;
+  insight: InsightAnswer;
+  actions?: AssistantActionV2[];
+  links?: Array<{ label: string; href: string }>;
+};
+
+export type ToolRunParams = {
+  schoolId: string;
+  role: string;
+  query: string;
+  context?: AiWidgetContext;
+};
+
+export type DataCopilotTool = {
+  id: string;
+  module: DataCopilotModule;
+  requiredPermission: string;
+  match: (query: string, context?: AiWidgetContext) => boolean;
+  run: (params: ToolRunParams) => Promise<DataCopilotResponse | null>;
+};
```

## Risco e reversão

Risco baixo: ficheiro apenas de tipos, sem imports por código produtivo nesta etapa. Reversível removendo o ficheiro num único commit.

