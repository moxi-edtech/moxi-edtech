export const AI_WIDGET_ROLES = [
  "admin",
  "admin_escola",
  "staff_admin",
  "secretaria",
  "financeiro",
  "admin_financeiro",
  "secretaria_financeiro",
  "direcao",
  "diretoria",
];

export const AI_ACTIONS_ACCESS_ROLES = AI_WIDGET_ROLES;

export const AI_ACTIONS_FINANCE_ROLES = [
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

export const AI_ACTIONS_SECRETARIA_ROLES = [
  "admin",
  "admin_escola",
  "staff_admin",
  "direcao",
  "diretoria",
  "secretaria",
];

export const AI_ADMIN_ROLES = [
  "admin",
  "admin_escola",
  "staff_admin",
  "direcao",
  "diretoria",
];

export const HELP_ADMIN_ROLES = [
  "admin",
  "admin_escola",
  "staff_admin",
  "secretaria",
  "financeiro",
  "admin_financeiro",
  "secretaria_financeiro",
  "direcao",
  "diretoria",
];

// Operational copilot is narrower than the legacy assistant: no finance-only access.
export const AI_OPERATIONAL_COPILOT_ROLES = AI_ACTIONS_SECRETARIA_ROLES;

export function canUseOperationalCopilot(role: string): boolean {
  return AI_OPERATIONAL_COPILOT_ROLES.includes(role.trim().toLowerCase());
}
