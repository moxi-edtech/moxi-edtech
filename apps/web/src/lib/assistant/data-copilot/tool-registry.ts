import { hasAssistantPermission } from "../permission-registry";
import { financeDebtByClassTool } from "./finance-debt-by-class";
import { academicGradeGapsTool } from "./tools/academic-grade-gaps";
import { academicLowAttendanceTool } from "./tools/academic-low-attendance";
import { academicPedagogicalRiskTool } from "./tools/academic-pedagogical-risk";
import { admissionsPendingTool } from "./tools/admissions-pending";
import { financeRiskSummaryTool } from "./tools/finance-risk-summary";
import { schoolDailyBriefingTool } from "./tools/school-daily-briefing";
import type { DataCopilotResponse, DataCopilotTool, ToolRunParams } from "./types";

const DATA_COPILOT_TOOLS: readonly DataCopilotTool[] = [
  schoolDailyBriefingTool,
  financeDebtByClassTool,
  financeRiskSummaryTool,
  admissionsPendingTool,
  academicPedagogicalRiskTool,
  academicGradeGapsTool,
  academicLowAttendanceTool,
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
    if (!tool.match(normalizedQuery, params.context)) continue;

    const response = await tool.run(params);
    if (response) return response;
  }

  return null;
}
