# KLASSE — Apply Diff
run_id: 496F43FD-8534-43A5-9FF7-EA582FAED27B
timestamp: 2026-07-18T11:50:06Z
commit_base: dea66ad0

## P0 checklist

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Acção

Criar o composer determinístico de respostas executivas do Data Copilot.

## Diff proposto

```diff
diff --git a/apps/web/src/lib/assistant/data-copilot/answer-composer.ts b/apps/web/src/lib/assistant/data-copilot/answer-composer.ts
new file mode 100644
--- /dev/null
+++ b/apps/web/src/lib/assistant/data-copilot/answer-composer.ts
@@
+import type { DataCopilotResponse, InsightAnswer } from "./types";
+
+function formatEvidence(evidence: InsightAnswer["evidence"]) {
+  if (evidence.length === 0) return "- Sem evidência disponível.";
+  return evidence.map(({ label, value }) => `- **${label}:** ${value}`).join("\n");
+}
+
+export function composeInsightAnswer(insight: InsightAnswer) {
+  return [
+    `**Diagnóstico**\n${insight.diagnosis}`,
+    `**Impacto**\n${insight.impact}`,
+    `**Próximo passo recomendado**\n${insight.recommendation}`,
+    `**Evidências**\n${formatEvidence(insight.evidence)}`,
+  ].join("\n\n");
+}
+
+export function createDataCopilotResponse(params: {
+  insight: InsightAnswer;
+  links?: DataCopilotResponse["links"];
+}): DataCopilotResponse {
+  return {
+    ok: true,
+    mode: "data_query",
+    operatingMode: "data",
+    answer: composeInsightAnswer(params.insight),
+    insight: params.insight,
+    actions: params.insight.actions.length > 0 ? params.insight.actions : undefined,
+    links: params.links?.length ? params.links : undefined,
+  };
+}
```

## Risco e reversão

Risco baixo: função pura e ainda não ligada ao runtime. Reversível removendo o ficheiro num único commit.

