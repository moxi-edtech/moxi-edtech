export type AssistantActionV2Kind =
  | "open_screen"
  | "open_drawer"
  | "prepare_draft"
  | "export"
  | "copy_text"
  | "save_ai_action"
  | "request_clarification";

export type AssistantActionV2Risk = "low" | "medium" | "high";

export type AssistantActionV2Module =
  | "dashboard"
  | "secretaria"
  | "financeiro"
  | "academico"
  | "comunicacao"
  | "whatsapp"
  | "classe_ai"
  | "operacoes"
  | "any";

export type AssistantActionV2 = {
  id: string;
  kind: AssistantActionV2Kind;
  label: string;
  description?: string;
  href?: string;
  payload?: Record<string, unknown>;
  riskLevel: AssistantActionV2Risk;
  requiresApproval: boolean;
  permission: string;
};

type ActionParams = Record<string, string | number | boolean | null | undefined>;

export type AssistantActionV2Definition = {
  id: string;
  kind: AssistantActionV2Kind;
  module: AssistantActionV2Module;
  label: string;
  description?: string;
  roles: string[];
  riskLevel: AssistantActionV2Risk;
  requiresApproval: boolean;
  permission: string;
  href?: (params: ActionParams) => string | undefined;
  payload?: (params: ActionParams) => Record<string, unknown> | undefined;
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
const ADMIN_ROLES = ["admin", "admin_escola", "staff_admin", "direcao", "diretoria"];

function stringParam(params: ActionParams, key: string) {
  const value = params[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export const ASSISTANT_ACTIONS_V2: AssistantActionV2Definition[] = [
  {
    id: "finance:open_radar",
    kind: "open_screen",
    module: "financeiro",
    label: "Abrir Radar Financeiro",
    description: "Abre o radar financeiro da escola para análise completa.",
    roles: FINANCE_ROLES,
    riskLevel: "low",
    requiresApproval: false,
    permission: "assistant.finance",
    href: (params) => {
      const schoolId = stringParam(params, "schoolId");
      return schoolId ? `/escola/${schoolId}/financeiro/radar` : undefined;
    },
  },
  {
    id: "finance:export_debtors_class",
    kind: "export",
    module: "financeiro",
    label: "Exportar lista",
    description: "Exporta a lista de alunos em atraso da turma selecionada.",
    roles: FINANCE_ROLES,
    riskLevel: "medium",
    requiresApproval: false,
    permission: "assistant.finance",
    href: (params) => {
      const schoolId = stringParam(params, "schoolId");
      const turmaId = stringParam(params, "turmaId");
      if (!schoolId || !turmaId) return undefined;
      return `/api/secretaria/alunos/exportar?escolaId=${encodeURIComponent(schoolId)}&turma_id=${encodeURIComponent(turmaId)}&situacao_financeira=em_atraso&tipo=pdf`;
    },
  },
  {
    id: "finance:prepare_whatsapp_draft",
    kind: "prepare_draft",
    module: "whatsapp",
    label: "Gerar rascunho WhatsApp",
    description: "Cria um rascunho para revisão; não envia mensagem.",
    roles: FINANCE_ROLES,
    riskLevel: "high",
    requiresApproval: true,
    permission: "assistant.whatsapp_draft",
    payload: () => ({ quickAction: "flow:whatsapp_draft" }),
  },
  {
    id: "finance:save_billing_plan",
    kind: "save_ai_action",
    module: "financeiro",
    label: "Criar plano de cobrança",
    description: "Salva plano financeiro como rascunho auditável.",
    roles: FINANCE_ROLES,
    riskLevel: "high",
    requiresApproval: true,
    permission: "assistant.finance",
    payload: () => ({ quickAction: "flow:finance_plan" }),
  },
  {
    id: "assistant:open_actions",
    kind: "open_drawer",
    module: "classe_ai",
    label: "Abrir Central de Ações IA",
    description: "Abre a central onde ficam rascunhos e ações assistidas.",
    roles: ALL_ROLES,
    riskLevel: "low",
    requiresApproval: false,
    permission: "assistant.ai_actions",
    payload: () => ({ quickAction: "quick:open_actions" }),
  },
  {
    id: "assistant:open_help",
    kind: "open_drawer",
    module: "any",
    label: "Encontrar caminho no sistema",
    description: "Abre a ajuda contextual do KLASSE.",
    roles: ALL_ROLES,
    riskLevel: "low",
    requiresApproval: false,
    permission: "assistant.help",
    payload: () => ({ quickAction: "quick:open_help" }),
  },
  {
    id: "assistant:screen_capabilities",
    kind: "open_drawer",
    module: "any",
    label: "Explicar tela atual",
    description: "Mostra ações disponíveis para o perfil nesta tela.",
    roles: ALL_ROLES,
    riskLevel: "low",
    requiresApproval: false,
    permission: "assistant.help",
    payload: () => ({ quickAction: "quick:screen_capabilities" }),
  },
  {
    id: "assistant:improve_notice",
    kind: "prepare_draft",
    module: "comunicacao",
    label: "Melhorar comunicado",
    description: "IA reescreve ou melhora um aviso para revisão humana.",
    roles: SECRETARIA_ROLES,
    riskLevel: "medium",
    requiresApproval: true,
    permission: "assistant.rewrite",
    payload: () => ({ quickAction: "flow:rewrite_notice" }),
  },
  {
    id: "assistant:generate_notice",
    kind: "save_ai_action",
    module: "comunicacao",
    label: "Gerar comunicado",
    description: "Cria rascunho de comunicado para aprovação antes de publicar.",
    roles: SECRETARIA_ROLES,
    riskLevel: "medium",
    requiresApproval: true,
    permission: "assistant.rewrite",
    payload: () => ({ quickAction: "flow:guided_notice" }),
  },
  {
    id: "assistant:generate_school_summary",
    kind: "prepare_draft",
    module: "dashboard",
    label: "Gerar resumo da escola",
    description: "Gera resumo executivo com base no contexto disponível.",
    roles: ADMIN_ROLES,
    riskLevel: "low",
    requiresApproval: false,
    permission: "assistant.summary",
    payload: () => ({ quickAction: "flow:screen_summary" }),
  },
  {
    id: "assistant:generate_billing_plan",
    kind: "save_ai_action",
    module: "financeiro",
    label: "Gerar plano de cobrança",
    description: "Cria plano de cobrança como rascunho auditável.",
    roles: FINANCE_ROLES,
    riskLevel: "high",
    requiresApproval: true,
    permission: "assistant.finance",
    payload: () => ({ quickAction: "flow:finance_plan" }),
  },
  {
    id: "assistant:create_finance_draft",
    kind: "prepare_draft",
    module: "financeiro",
    label: "Criar rascunho financeiro",
    description: "Gera rascunho financeiro para revisão posterior.",
    roles: FINANCE_ROLES,
    riskLevel: "high",
    requiresApproval: true,
    permission: "assistant.finance",
    payload: () => ({ quickAction: "flow:finance_plan" }),
  },
  {
    id: "assistant:create_whatsapp_draft",
    kind: "prepare_draft",
    module: "whatsapp",
    label: "Criar rascunho WhatsApp",
    description: "Gera mensagem com placeholders; não envia pelo chat.",
    roles: FINANCE_ROLES,
    riskLevel: "high",
    requiresApproval: true,
    permission: "assistant.whatsapp_draft",
    payload: () => ({ quickAction: "flow:whatsapp_draft" }),
  },
  {
    id: "assistant:save_in_ai_actions",
    kind: "open_drawer",
    module: "classe_ai",
    label: "Salvar na Central de Ações IA",
    description: "Abre a central para guardar rascunhos auditáveis.",
    roles: ALL_ROLES,
    riskLevel: "low",
    requiresApproval: false,
    permission: "assistant.ai_actions",
    payload: () => ({ quickAction: "quick:open_actions" }),
  },
  {
    id: "assistant:find_system_path",
    kind: "open_drawer",
    module: "any",
    label: "Encontrar caminho no sistema",
    description: "Abre a ajuda contextual do KLASSE.",
    roles: ALL_ROLES,
    riskLevel: "low",
    requiresApproval: false,
    permission: "assistant.help",
    payload: () => ({ quickAction: "quick:open_help" }),
  },
  {
    id: "assistant:explain_current_screen",
    kind: "open_drawer",
    module: "any",
    label: "Explicar tela atual",
    description: "Mostra ações disponíveis para o perfil nesta tela.",
    roles: ALL_ROLES,
    riskLevel: "low",
    requiresApproval: false,
    permission: "assistant.help",
    payload: () => ({ quickAction: "quick:screen_capabilities" }),
  },
];

export function createAssistantActionV2(action: AssistantActionV2): AssistantActionV2 {
  return action;
}

export function canUseAssistantActionV2(role: string, action: Pick<AssistantActionV2Definition, "roles">): boolean {
  const cleanRole = role.toLowerCase().trim();
  return action.roles.includes(cleanRole);
}

export function instantiateAssistantActionV2(
  id: string,
  role: string,
  params: ActionParams = {},
  overrides: Partial<Pick<AssistantActionV2, "label" | "description" | "href" | "payload">> = {}
): AssistantActionV2 | null {
  const definition = ASSISTANT_ACTIONS_V2.find((action) => action.id === id);
  if (!definition || !canUseAssistantActionV2(role, definition)) return null;

  const href = overrides.href ?? definition.href?.(params);
  const payload = overrides.payload ?? definition.payload?.(params);

  return createAssistantActionV2({
    id: definition.id,
    kind: definition.kind,
    label: overrides.label ?? definition.label,
    description: overrides.description ?? definition.description,
    href,
    payload,
    riskLevel: definition.riskLevel,
    requiresApproval: definition.requiresApproval,
    permission: definition.permission,
  });
}
