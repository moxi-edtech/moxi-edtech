import type { DataCopilotResponse, InsightAnswer } from "./types";

function formatEvidence(evidence: InsightAnswer["evidence"]) {
  if (evidence.length === 0) return "- Sem evidência disponível.";
  return evidence.map(({ label, value }) => `- **${label}:** ${value}`).join("\n");
}

export function composeInsightAnswer(insight: InsightAnswer) {
  return [
    `**Diagnóstico**\n${insight.diagnosis}`,
    `**Impacto**\n${insight.impact}`,
    `**Próximo passo recomendado**\n${insight.recommendation}`,
    `**Evidências**\n${formatEvidence(insight.evidence)}`,
  ].join("\n\n");
}

export function createDataCopilotResponse(params: {
  insight: InsightAnswer;
  links?: DataCopilotResponse["links"];
}): DataCopilotResponse {
  return {
    ok: true,
    mode: "data_query",
    operatingMode: "data",
    answer: composeInsightAnswer(params.insight),
    insight: params.insight,
    actions: params.insight.actions.length > 0 ? params.insight.actions : undefined,
    links: params.links?.length ? params.links : undefined,
  };
}
