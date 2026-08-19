import type { AssistantActionV2 } from "../actions-v2";
import type { AiWidgetContext } from "../screen-context";

export type DataCopilotModule = "financeiro" | "secretaria" | "academico" | "direcao";

export type AssistantOperatingMode = "help" | "data" | "action";

export type InsightEvidence = {
  label: string;
  value: string;
};

export type InsightProvenance = {
  source: string;
  consultedAt: string;
  scope: string;
  freshness: "live" | "partial" | "unknown";
  limitation?: string;
};

export type InsightSeverity = "info" | "low" | "medium" | "high" | "critical";

export type InsightAnswer = {
  severity?: InsightSeverity;
  diagnosis: string;
  impact: string;
  recommendation: string;
  evidence: InsightEvidence[];
  actions: AssistantActionV2[];
  provenance?: InsightProvenance;
};

export type DataCopilotResponse = {
  ok: true;
  mode: "data_query";
  toolId?: string;
  operatingMode: "data";
  answer: string;
  insight: InsightAnswer;
  actions?: AssistantActionV2[];
  links?: Array<{ label: string; href: string }>;
};

export type ToolRunParams = {
  schoolId: string;
  role: string;
  query: string;
  context?: AiWidgetContext;
};

export type DataCopilotTool = {
  id: string;
  module: DataCopilotModule;
  requiredPermission: string;
  match: (query: string, context?: AiWidgetContext) => boolean;
  run: (params: ToolRunParams) => Promise<DataCopilotResponse | null>;
};
