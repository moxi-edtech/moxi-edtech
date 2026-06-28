export type AiWidgetContext = {
  module:
    | "dashboard"
    | "financeiro"
    | "secretaria"
    | "academico"
    | "comunicacao"
    | "whatsapp"
    | "classe_ai"
    | "operacoes";
  page?: string;
  entityType?: "student" | "guardian" | "class" | "teacher" | "invoice" | "notice" | "none";
  entityId?: string;
  capabilities?: string[];
  selectedCount?: number;
  readonly?: boolean;
};

export function getFriendlyModuleName(module: AiWidgetContext["module"]): string {
  const names: Record<AiWidgetContext["module"], string> = {
    dashboard: "Dashboard Geral",
    financeiro: "Financeiro",
    secretaria: "Secretaria",
    academico: "Acadêmico / Notas / Presenças",
    comunicacao: "Comunicação / Avisos",
    whatsapp: "Central WhatsApp",
    classe_ai: "Central de Ações IA",
    operacoes: "Operações Escolares",
  };
  return names[module] || "Módulo Geral";
}

export function describeScreenContext(context?: AiWidgetContext): string {
  if (!context) return "tela geral do KLASSE";

  let desc = `módulo ${getFriendlyModuleName(context.module)}`;
  if (context.page) {
    desc += ` (página: ${context.page})`;
  }

  if (context.entityType && context.entityType !== "none") {
    desc += `, focado em um recurso do tipo ${context.entityType}`;
    if (context.entityId) {
      desc += ` (ID: ${context.entityId})`;
    }
  }

  if (context.selectedCount && context.selectedCount > 0) {
    desc += `, com ${context.selectedCount} itens selecionados`;
  }

  if (context.readonly) {
    desc += " (modo somente leitura)";
  }

  return desc;
}

export function sanitizeContextForAi(context?: AiWidgetContext): Partial<AiWidgetContext> {
  if (!context) return {};

  // NEVER send detailed individual PII info like student names, only basic structure metadata
  return {
    module: context.module,
    page: context.page,
    entityType: context.entityType,
    // Keep ID but strip real names/sensitive properties
    entityId: context.entityId,
    selectedCount: context.selectedCount,
    capabilities: context.capabilities,
    readonly: context.readonly,
  };
}
