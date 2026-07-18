# KLASSE — Apply Diff
run_id: D0D48CAC-8FAA-4CFD-B7FF-C50A9C019D5E
timestamp: 2026-07-18T12:09:35Z
commit_base: dea66ad0

## P0 checklist

Todos os itens de `P0_CHECKLIST.md` estão marcados como PASS.

## Acção

Criar `finance-risk-summary` sobre a view canônica de inadimplência agregada.

## Diff proposto

```diff
diff --git a/apps/web/src/lib/assistant/data-copilot/tools/finance-risk-summary.ts b/apps/web/src/lib/assistant/data-copilot/tools/finance-risk-summary.ts
new file mode 100644
--- /dev/null
+++ b/apps/web/src/lib/assistant/data-copilot/tools/finance-risk-summary.ts
@@
+import { instantiateAssistantActionV2, type AssistantActionV2 } from "../../actions-v2";
+import type { AiWidgetContext } from "../../screen-context";
+import { supabaseServerTyped } from "@/lib/supabaseServer";
+import { createDataCopilotResponse } from "../answer-composer";
+import type { DataCopilotTool } from "../types";
+
+type RiskRow = { valor_em_atraso: number | string | null; dias_em_atraso: number | null };
+const AOA = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" });
+
+export function isFinanceRiskSummaryQuery(query: string, context?: AiWidgetContext) {
+  const scope = /finance|inadimpl|d[ií]vida|devedor|cobran[cç]a/.test(query) || context?.module === "financeiro";
+  return Boolean(scope && /risco|resumo|total|aten[cç][aã]o|situa[cç][aã]o/.test(query));
+}
+
+export const financeRiskSummaryTool: DataCopilotTool = {
+  id: "finance-risk-summary", module: "financeiro", requiredPermission: "assistant.finance", match: isFinanceRiskSummaryQuery,
+  async run({ schoolId, role }) {
+    const supabase = await supabaseServerTyped();
+    const { data, count, error } = await supabase.from("vw_financeiro_inadimplencia_top")
+      .select("valor_em_atraso, dias_em_atraso", { count: "exact" }).eq("escola_id", schoolId)
+      .order("valor_em_atraso", { ascending: false }).limit(50);
+    if (error) throw error;
+    const rows = (data ?? []) as RiskRow[];
+    const debtors = count ?? rows.length;
+    const sampleDebt = rows.reduce((sum, row) => sum + Number(row.valor_em_atraso ?? 0), 0);
+    const maxDays = rows.reduce((max, row) => Math.max(max, Number(row.dias_em_atraso ?? 0)), 0);
+    const action = instantiateAssistantActionV2("finance:open_radar", role, { schoolId });
+    const actions: AssistantActionV2[] = action ? [action] : [];
+    return createDataCopilotResponse({ insight: {
+      diagnosis: debtors === 0 ? "Não há devedores no resumo financeiro atual." : `O radar identifica **${debtors} alunos com valores em atraso**.`,
+      impact: debtors === 0 ? "Não há risco vencido identificado nesta fonte." : `Os 50 maiores casos somam **${AOA.format(sampleDebt)}** e chegam a **${maxDays} dias de atraso**.`,
+      recommendation: debtors === 0 ? "Manter a monitorização do radar." : "Priorizar os maiores valores e atrasos mais antigos para cobrança segmentada.",
+      evidence: [
+        { label: "Alunos em atraso", value: String(debtors) },
+        { label: "Valor nos 50 maiores casos", value: AOA.format(sampleDebt) },
+        { label: "Maior atraso", value: `${maxDays} dias` },
+      ], actions,
+    }});
+  },
+};
```

## Risco e reversão

Risco baixo: leitura da view canônica filtrada por escola e limitada a 50 linhas de evidência.

