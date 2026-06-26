export type AiWidgetContext = {
  module:
    | "dashboard"
    | "financeiro"
    | "secretaria"
    | "academico"
    | "comunicacao"
    | "classe_ai"
    | "whatsapp"
    | "operacoes";
  page?: string;
  entityType?: "student" | "guardian" | "class" | "teacher" | "invoice" | "notice" | "none";
  entityId?: string;
  capabilities?: string[];
  selectedCount?: number;
  readonly?: boolean;
};

export type AssistantSuggestion = {
  key: string;
  title: string;
  description?: string;
  module: AiWidgetContext["module"] | "any";
  pages?: string[];
  roles: string[];
  requiredFeatures?: string[];
  riskLevel: "low" | "medium" | "high";
  actionType:
    | "navigate"
    | "rewrite"
    | "summary"
    | "create_ai_action"
    | "create_whatsapp_draft"
    | "open_help"
    | "open_central";
  href?: (schoolId: string, context?: AiWidgetContext) => string;
};

const ALL_ADMIN_ROLES = [
  "admin",
  "admin_escola",
  "staff_admin",
  "direcao",
  "diretoria",
  "secretaria",
  "financeiro",
  "admin_financeiro",
  "secretaria_financeiro",
];

const FINANCE_ROLES = [
  "admin",
  "admin_escola",
  "direcao",
  "diretoria",
  "financeiro",
  "admin_financeiro",
  "secretaria_financeiro",
];

const SECRETARIA_ROLES = ["admin", "admin_escola", "staff_admin", "direcao", "diretoria", "secretaria"];

export const ASSISTANT_SUGGESTIONS: AssistantSuggestion[] = [
  {
    key: "screen_capabilities",
    title: "O que posso fazer nesta tela?",
    description: "Ver ações seguras e caminhos úteis para o contexto atual.",
    module: "any",
    roles: ALL_ADMIN_ROLES,
    riskLevel: "low",
    actionType: "open_help",
  },
  {
    key: "finance_plan",
    title: "Criar plano de cobrança",
    description: "Preparar plano e rascunho financeiro para revisão.",
    module: "financeiro",
    pages: ["radar", "financeiro"],
    roles: FINANCE_ROLES,
    requiredFeatures: ["finance_message"],
    riskLevel: "high",
    actionType: "create_ai_action",
  },
  {
    key: "finance_whatsapp_draft",
    title: "Criar rascunhos para inadimplentes",
    description: "Gerar mensagem financeira para aprovação na Central WhatsApp.",
    module: "financeiro",
    pages: ["radar"],
    roles: FINANCE_ROLES,
    requiredFeatures: ["finance_message"],
    riskLevel: "high",
    actionType: "create_whatsapp_draft",
  },
  {
    key: "finance_summary",
    title: "Explicar prioridades",
    description: "Gerar resumo financeiro curto com próximos passos.",
    module: "financeiro",
    roles: FINANCE_ROLES,
    requiredFeatures: ["summary"],
    riskLevel: "low",
    actionType: "summary",
  },
  {
    key: "open_whatsapp",
    title: "Abrir Central WhatsApp",
    module: "financeiro",
    pages: ["radar"],
    roles: FINANCE_ROLES,
    riskLevel: "low",
    actionType: "navigate",
    href: (schoolId) => `/escola/${schoolId}/admin/comunicacao/whatsapp`,
  },
  {
    key: "student_new",
    title: "Cadastrar novo aluno",
    module: "secretaria",
    pages: ["alunos", "secretaria"],
    roles: SECRETARIA_ROLES,
    riskLevel: "low",
    actionType: "navigate",
    href: (schoolId) => `/escola/${schoolId}/secretaria/admissoes/nova`,
  },
  {
    key: "student_summary",
    title: "Gerar resumo da ficha",
    module: "secretaria",
    pages: ["alunos"],
    roles: SECRETARIA_ROLES,
    requiredFeatures: ["summary"],
    riskLevel: "low",
    actionType: "summary",
  },
  {
    key: "communication_rewrite",
    title: "Melhorar comunicado",
    description: "Reescrever texto em tom formal, curto ou amigável.",
    module: "comunicacao",
    roles: SECRETARIA_ROLES,
    requiredFeatures: ["rewrite"],
    riskLevel: "medium",
    actionType: "rewrite",
  },
  {
    key: "communication_guided",
    title: "Criar comunicado guiado",
    module: "comunicacao",
    roles: SECRETARIA_ROLES,
    requiredFeatures: ["generate_communication"],
    riskLevel: "medium",
    actionType: "create_ai_action",
  },
  {
    key: "open_actions",
    title: "Abrir Central de Ações IA",
    module: "any",
    roles: ALL_ADMIN_ROLES,
    riskLevel: "low",
    actionType: "open_central",
    href: (schoolId) => `/escola/${schoolId}/admin/ai/actions`,
  },
];

export function getAssistantSuggestions(params: {
  context?: AiWidgetContext;
  role: string;
  allowedFeatures?: string[];
}) {
  const role = params.role.toLowerCase();
  const allowed = params.allowedFeatures ?? [];
  return ASSISTANT_SUGGESTIONS.filter((suggestion) => {
    if (!suggestion.roles.includes(role)) return false;
    if (suggestion.module !== "any" && suggestion.module !== params.context?.module) return false;
    if (suggestion.pages?.length && params.context?.page && !suggestion.pages.includes(params.context.page)) return false;
    if (suggestion.requiredFeatures?.length) {
      if (allowed.length === 0) return false;
      if (!suggestion.requiredFeatures.every((feature) => allowed.includes(feature))) return false;
    }
    return true;
  });
}

export function describeContext(context?: AiWidgetContext) {
  if (context?.module === "financeiro" && context.page === "radar") return "Radar Financeiro";
  if (context?.module === "financeiro") return "Financeiro";
  if (context?.module === "secretaria" && context.page === "alunos") return "Alunos";
  if (context?.module === "secretaria") return "Secretaria";
  if (context?.module === "comunicacao") return "Comunicação";
  if (context?.module === "whatsapp") return "Central WhatsApp";
  if (context?.module === "classe_ai") return "Central de Ações IA";
  return "esta tela";
}
