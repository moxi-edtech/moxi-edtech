export type AssistantPermission = {
  key: string;
  roles: string[];
  description: string;
};

export const BASE_ROLES = [
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

const ALL_ROLES = [...BASE_ROLES];
const SECRETARIA_AND_UP = ["admin", "admin_escola", "staff_admin", "direcao", "diretoria", "secretaria"];
const FINANCE_ROLES = ["admin", "admin_escola", "direcao", "diretoria", "financeiro", "admin_financeiro", "secretaria_financeiro"];
const ADMIN_ROLES = ["admin", "admin_escola", "staff_admin", "direcao", "diretoria"];

export const ASSISTANT_PERMISSIONS: AssistantPermission[] = [
  {
    key: "assistant.view",
    roles: ALL_ROLES,
    description: "Permite visualizar o assistente na interface.",
  },
  {
    key: "assistant.help",
    roles: ALL_ROLES,
    description: "Permite usar o assistente para pesquisar caminhos e tópicos de ajuda local.",
  },
  {
    key: "assistant.rewrite",
    roles: SECRETARIA_AND_UP,
    description: "Permite usar IA para reescrever e polir comunicados/avisos.",
  },
  {
    key: "assistant.summary",
    roles: ALL_ROLES,
    description: "Permite usar IA para resumir indicadores da tela atual ou ficha de aluno.",
  },
  {
    key: "assistant.finance",
    roles: FINANCE_ROLES,
    description: "Permite usar o assistente para ações financeiras (gerar rascunhos de cobrança, analisar radar).",
  },
  {
    key: "assistant.whatsapp_draft",
    roles: FINANCE_ROLES, // Apenas perfis financeiros podem sugerir mensagens financeiras para WhatsApp
    description: "Permite gerar rascunhos de mensagens para o WhatsApp a partir do radar financeiro.",
  },
  {
    key: "assistant.ai_actions",
    roles: ALL_ROLES,
    description: "Permite salvar rascunhos gerados na Central de Ações IA.",
  },
  {
    key: "assistant.admin_config",
    roles: ADMIN_ROLES,
    description: "Permite acessar configurações do assistente e status da API WhatsApp.",
  },
];

export function hasAssistantPermission(role: string, permissionKey: string): boolean {
  const cleanRole = role.toLowerCase().trim();

  // Explicitly deny students, teachers, guardians in this sprint
  const deniedRoles = ["aluno", "professor", "encarregado", "docente", "guardian", "parent"];
  if (deniedRoles.includes(cleanRole)) {
    return false;
  }

  const perm = ASSISTANT_PERMISSIONS.find((p) => p.key === permissionKey);
  if (!perm) return false;

  return perm.roles.includes(cleanRole);
}
