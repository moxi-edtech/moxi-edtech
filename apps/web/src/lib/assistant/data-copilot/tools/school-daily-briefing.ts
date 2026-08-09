import { hasAssistantPermission } from "../../permission-registry";
import { createDataCopilotResponse } from "../answer-composer";
import { matchesIntentTerms, normalizeAssistantText } from "../query-matcher";
import type {
  DataCopilotResponse,
  DataCopilotTool,
  InsightSeverity,
  ToolRunParams,
} from "../types";
import { academicGradeGapsTool } from "./academic-grade-gaps";
import { academicLowAttendanceTool } from "./academic-low-attendance";
import { academicPedagogicalRiskTool } from "./academic-pedagogical-risk";
import { admissionsPendingTool } from "./admissions-pending";
import { financeRiskSummaryTool } from "./finance-risk-summary";
import { academicCalendarOperationsTool } from "./academic-calendar-operations";

const BRIEFING_SOURCES = [
  { label: "Financeiro", tool: financeRiskSummaryTool },
  { label: "Admissões", tool: admissionsPendingTool },
  { label: "Risco pedagógico", tool: academicPedagogicalRiskTool },
  { label: "Notas", tool: academicGradeGapsTool },
  { label: "Frequência", tool: academicLowAttendanceTool },
  { label: "Calendário MED", tool: academicCalendarOperationsTool },
] as const;

type BriefingSource = (typeof BRIEFING_SOURCES)[number];

export function isDailyBriefingQuery(query: string) {
  const normalizedQuery = normalizeAssistantText(query);
  const asksForBriefing = matchesIntentTerms(
    normalizedQuery,
    ["briefing", "prioridade", "resumo", "atencao", "risco", "foco"],
    { maxDistance: 2 },
  );
  const hasTimeOrSchoolScope = matchesIntentTerms(
    normalizedQuery,
    ["hoje", "dia", "diario", "semana", "escola"],
    { maxDistance: 1 },
  );

  return asksForBriefing && (
    hasTimeOrSchoolScope ||
    normalizedQuery.startsWith("o que ") ||
    normalizedQuery === "briefing"
  );
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

function calculateBriefingSeverity(scores: number[], unavailableCount: number): InsightSeverity {
  const maximum = Math.max(0, ...scores);
  const total = scores.reduce((sum, value) => sum + value, 0);

  if (maximum >= 50 || total >= 100) return "high";
  if (maximum >= 10 || total >= 25 || unavailableCount > 0) return "medium";
  if (maximum > 0) return "low";
  return "info";
}

export const schoolDailyBriefingTool: DataCopilotTool = {
  id: "school-daily-briefing",
  module: "direcao",
  requiredPermission: "assistant.summary",
  match: isDailyBriefingQuery,
  async run(params) {
    const eligibleSources = BRIEFING_SOURCES.filter((source) =>
      hasAssistantPermission(params.role, source.tool.requiredPermission),
    );
    const settled = await Promise.allSettled(
      eligibleSources.map((source) => runSource(source, params)),
    );
    const results = settled.flatMap((result) => (
      result.status === "fulfilled" && result.value ? [result.value] : []
    ));
    const unavailableSources = settled.flatMap((result, index) => (
      result.status === "rejected" || !result.value ? [eligibleSources[index].label] : []
    ));

    if (results.length === 0) return null;

    const priorities = [...results]
      .sort((a, b) => score(b.response) - score(a.response))
      .slice(0, 3);
    const severity = calculateBriefingSeverity(
      priorities.map(({ response }) => score(response)),
      unavailableSources.length,
    );
    const coverageNotice = unavailableSources.length > 0
      ? `**Briefing parcial:** ${unavailableSources.join(", ")} ${unavailableSources.length === 1 ? "não respondeu" : "não responderam"}.`
      : `**Briefing completo:** ${results.length} fontes consultadas com sucesso.`;
    const actions = priorities
      .flatMap(({ response }) => response.insight.actions)
      .filter((action, index, all) => all.findIndex((item) => item.id === action.id) === index);

    return createDataCopilotResponse({
      insight: {
        severity,
        diagnosis: [
          coverageNotice,
          ...priorities.map(
            ({ label, response }, index) =>
              `${index + 1}. **${label}:** ${response.insight.diagnosis}`,
          ),
        ].join("\n"),
        impact: priorities
          .map(({ label, response }) => `- **${label}:** ${response.insight.impact}`)
          .join("\n"),
        recommendation: priorities
          .map(({ label, response }) => `- **${label}:** ${response.insight.recommendation}`)
          .join("\n"),
        evidence: [
          {
            label: "Cobertura do briefing",
            value: `${results.length}/${eligibleSources.length} fontes`,
          },
          {
            label: "Fontes indisponíveis",
            value: unavailableSources.length > 0 ? unavailableSources.join(", ") : "Nenhuma",
          },
          ...priorities.flatMap(({ label, response }) =>
            response.insight.evidence.slice(0, 1).map((item) => ({
              label: `${label} — ${item.label}`,
              value: item.value,
            })),
          ),
        ],
        actions,
      },
    });
  },
};
