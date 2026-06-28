export type AssistantAction = {
  key: string;
  title: string;
  module: "dashboard" | "secretaria" | "financeiro" | "academico" | "comunicacao" | "whatsapp" | "classe_ai" | "operacoes" | "any";
  description: string;
  roles: string[];
  riskLevel: "low" | "medium" | "high";
  actionType: "navigate" | "help" | "rewrite" | "summary" | "create_draft" | "create_ai_action" | "create_whatsapp_draft";
  requiresApproval: boolean;
  href?: (schoolId: string, params?: Record<string, string>) => string;
};

const ALL_ROLES = [
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

const SECRETARIA_ROLES = ["admin", "admin_escola", "staff_admin", "direcao", "diretoria", "secretaria"];
const FINANCE_ROLES = ["admin", "admin_escola", "direcao", "diretoria", "financeiro", "admin_financeiro", "secretaria_financeiro"];
const ADMIN_ROLES = ["admin", "admin_escola", "staff_admin", "direcao", "diretoria"];

export const ASSISTANT_ACTIONS: AssistantAction[] = [
  {
    key: "navigate_to_screen",
    title: "Abrir tela",
    module: "any",
    description: "Navegar para uma tela específica do sistema usando a barra lateral ou link.",
    roles: ALL_ROLES,
    riskLevel: "low",
    actionType: "navigate",
    requiresApproval: false,
  },
  {
    key: "explain_current_screen",
    title: "Explicar tela atual",
    module: "any",
    description: "Obter explicações e ações rápidas sobre a tela onde você se encontra.",
    roles: ALL_ROLES,
    riskLevel: "low",
    actionType: "help",
    requiresApproval: false,
  },
  {
    key: "improve_notice",
    title: "Melhorar comunicado",
    module: "comunicacao",
    description: "IA reescreve ou melhora um aviso de comunicação de forma mais formal ou clara.",
    roles: SECRETARIA_ROLES,
    riskLevel: "medium",
    actionType: "rewrite",
    requiresApproval: true, // Requer aprovação ou revisão humana antes de publicar
  },
  {
    key: "generate_notice",
    title: "Gerar comunicado",
    module: "comunicacao",
    description: "IA gera rascunho de comunicado com base em ideias principais.",
    roles: SECRETARIA_ROLES,
    riskLevel: "medium",
    actionType: "create_ai_action",
    requiresApproval: true,
  },
  {
    key: "generate_school_summary",
    title: "Gerar resumo da escola",
    module: "dashboard",
    description: "IA gera um resumo executivo com indicadores consolidados para a direção.",
    roles: ADMIN_ROLES,
    riskLevel: "low",
    actionType: "summary",
    requiresApproval: false,
  },
  {
    key: "generate_billing_plan",
    title: "Gerar plano de cobrança",
    module: "financeiro",
    description: "IA monta um plano com regras e cronograma para reaver propinas em atraso.",
    roles: FINANCE_ROLES,
    riskLevel: "high",
    actionType: "create_ai_action",
    requiresApproval: true,
  },
  {
    key: "create_finance_draft",
    title: "Criar rascunho financeiro",
    module: "financeiro",
    description: "Gerar um rascunho de plano de ação de cobrança para posterior aprovação.",
    roles: FINANCE_ROLES,
    riskLevel: "high",
    actionType: "create_draft",
    requiresApproval: true,
  },
  {
    key: "create_whatsapp_draft",
    title: "Criar rascunho WhatsApp",
    module: "whatsapp",
    description: "IA gera mensagem com placeholders para envio posterior via WhatsApp.",
    roles: FINANCE_ROLES,
    riskLevel: "high",
    actionType: "create_whatsapp_draft",
    requiresApproval: true, // WhatsApp sempre exige aprovação/revisão antes do envio real
  },
  {
    key: "save_in_ai_actions",
    title: "Salvar na Central de Ações IA",
    module: "classe_ai",
    description: "Salvar o rascunho gerado pela IA na Central de Ações para auditoria e aprovação.",
    roles: ALL_ROLES,
    riskLevel: "low",
    actionType: "create_draft",
    requiresApproval: false,
  },
  {
    key: "open_whatsapp_inbox",
    title: "Abrir Central WhatsApp",
    module: "whatsapp",
    description: "Acessar a Central WhatsApp da escola para enviar mensagens ou gerenciar contatos.",
    roles: ALL_ROLES,
    riskLevel: "low",
    actionType: "navigate",
    requiresApproval: false,
    href: (schoolId) => `/escola/${schoolId}/admin/comunicacao/whatsapp`,
  },
  {
    key: "find_system_path",
    title: "Encontrar caminho no sistema",
    module: "any",
    description: "Perguntar onde se encontra uma funcionalidade no sistema e obter o caminho e link oficial.",
    roles: ALL_ROLES,
    riskLevel: "low",
    actionType: "help",
    requiresApproval: false,
  },
];

export function getActionsForRole(role: string, module?: string): AssistantAction[] {
  const cleanRole = role.toLowerCase().trim();
  return ASSISTANT_ACTIONS.filter((action) => {
    if (!action.roles.includes(cleanRole)) return false;
    if (module && action.module !== "any" && action.module !== module) return false;
    return true;
  });
}
