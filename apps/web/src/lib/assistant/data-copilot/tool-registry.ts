import { hasAssistantPermission } from "../permission-registry";
import { financeDebtByClassTool } from "./finance-debt-by-class";
import { academicGradeGapsTool } from "./tools/academic-grade-gaps";
import { academicLowAttendanceTool } from "./tools/academic-low-attendance";
import { academicCalendarOperationsTool } from "./tools/academic-calendar-operations";
import { academicPedagogicalRiskTool } from "./tools/academic-pedagogical-risk";
import { admissionsPendingTool } from "./tools/admissions-pending";
import { financeRiskSummaryTool } from "./tools/finance-risk-summary";
import { schoolDailyBriefingTool } from "./tools/school-daily-briefing";
import type { DataCopilotResponse, DataCopilotTool, ToolRunParams } from "./types";
import { canUseRecurringTuition } from "@/lib/school-profile/finance-capabilities";
import { filterAssistantActionsV2ForProfile } from "../actions-v2";

const DATA_COPILOT_TOOLS: readonly DataCopilotTool[] = [
  schoolDailyBriefingTool,
  financeDebtByClassTool,
  financeRiskSummaryTool,
  admissionsPendingTool,
  academicPedagogicalRiskTool,
  academicGradeGapsTool,
  academicLowAttendanceTool,
  academicCalendarOperationsTool,
];

export function getDataCopilotTools() {
  return DATA_COPILOT_TOOLS;
}

export async function runDataCopilotTool(
  params: ToolRunParams,
): Promise<DataCopilotResponse | null> {
  const normalizedQuery = params.query.trim().toLowerCase();

  for (const tool of DATA_COPILOT_TOOLS) {
    if (!hasAssistantPermission(params.role, tool.requiredPermission)) continue;
    if (tool.module === "financeiro" && params.operatingProfile && !canUseRecurringTuition(params.operatingProfile)) continue;
    if (!tool.match(normalizedQuery, params.context)) continue;

    const response = await tool.run(params);
    if (response) {
      response.insight.actions = filterAssistantActionsV2ForProfile(response.insight.actions, params.operatingProfile);
      response.actions = response.insight.actions.length > 0 ? response.insight.actions : undefined;
      return {
        ...response,
        toolId: tool.id,
        insight: {
          ...response.insight,
          provenance: response.insight.provenance ?? {
            source: tool.id,
            consultedAt: new Date().toISOString(),
            scope: "Escola selecionada",
            freshness: "live",
          },
        },
      };
    }
  }

  return null;
}
