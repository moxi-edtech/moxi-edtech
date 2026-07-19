import { hasAssistantPermission } from "../../permission-registry";
import { createDataCopilotResponse } from "../answer-composer";
import type { DataCopilotResponse, DataCopilotTool, ToolRunParams } from "../types";
import { academicGradeGapsTool } from "./academic-grade-gaps";
import { academicLowAttendanceTool } from "./academic-low-attendance";
import { admissionsPendingTool } from "./admissions-pending";
import { financeRiskSummaryTool } from "./finance-risk-summary";

const BRIEFING_SOURCES = [
  { label: "Financeiro", tool: financeRiskSummaryTool },
  { label: "Admissões", tool: admissionsPendingTool },
  { label: "Notas", tool: academicGradeGapsTool },
  { label: "Frequência", tool: academicLowAttendanceTool },
] as const;

type BriefingSource = (typeof BRIEFING_SOURCES)[number];

export function isDailyBriefingQuery(query: string) {
  return /o que.*(aten[cç][aã]o|prioridade)|resumo (do dia|di[aá]rio)|briefing|riscos? (de hoje|da escola)|foco.*semana/.test(query);
}

async function runSource(source: BriefingSource, params: ToolRunParams) {
  if (!hasAssistantPermission(params.role, source.tool.requiredPermission)) return null;
  const response = await source.tool.run(params);
  return response ? { label: source.label, response } : null;
}

function score(response: DataCopilotResponse) {
  const value = response.insight.evidence[0]?.value ?? "0";
  return Number.parseInt(value.replace(/\D/g, ""), 10) || 0;
}

export const schoolDailyBriefingTool: DataCopilotTool = {
  id: "school-daily-briefing",
  module: "direcao",
  requiredPermission: "assistant.summary",
  match: isDailyBriefingQuery,
  async run(params) {
    const settled = await Promise.allSettled(
      BRIEFING_SOURCES.map((source) => runSource(source, params)),
    );
    const results = settled.flatMap((result) =>
      result.status === "fulfilled" && result.value ? [result.value] : [],
    );

    if (results.length === 0) return null;

    const priorities = [...results]
      .sort((a, b) => score(b.response) - score(a.response))
      .slice(0, 3);
    const actions = priorities
      .flatMap(({ response }) => response.insight.actions)
      .filter((action, index, all) => all.findIndex((item) => item.id === action.id) === index);

    return createDataCopilotResponse({
      insight: {
        diagnosis: priorities
          .map(({ label, response }, index) => `${index + 1}. **${label}:** ${response.insight.diagnosis}`)
          .join("\n"),
        impact: priorities
          .map(({ label, response }) => `- **${label}:** ${response.insight.impact}`)
          .join("\n"),
        recommendation: priorities
          .map(({ label, response }) => `- **${label}:** ${response.insight.recommendation}`)
          .join("\n"),
        evidence: priorities.flatMap(({ label, response }) =>
          response.insight.evidence.slice(0, 1).map((item) => ({
            label: `${label} — ${item.label}`,
            value: item.value,
          })),
        ),
        actions,
      },
    });
  },
};
