/**
 * MOTOR DE NAVEGAÇÃO MULTI-TENANT & RBAC (PRO-SOLO)
 * Ficheiro puro: Sem Hooks, Sem Context, Apenas Lógica Síncrona.
 */

export type TenantType = "K12" | "CENTER" | "SOLO_CREATOR";
export type UserRole = "ADMIN" | "MENTOR" | "SECRETARIA" | "ALUNO";

export interface NavItem {
  id: string;
  href: string;
  icon: string; // Nome do ícone para ser resolvido pelo componente de UI
  label: string | (Partial<Record<TenantType, string>> & { default: string });
  allowedTenantTypes?: TenantType[];
  allowedRoles?: UserRole[];
  group: "Gestão" | "Académico" | "Financeiro" | "Suporte";
}

/**
 * Mapeia tenant_type do banco para o tipo de navegação.
 * "formacao" deve sempre resultar em CENTER.
 */
export function mapTenantTypeFromDb(tenantFromDB: string | null | undefined): TenantType {
  if (tenantFromDB === "k12") return "K12";
  if (tenantFromDB === "solo_creator") return "SOLO_CREATOR";
  if (tenantFromDB === "formacao") return "CENTER";
  return "CENTER";
}

export function mapUserRoleFromDb(role: string | null | undefined): UserRole {
  const r = String(role ?? "").trim().toLowerCase();
  if (["formacao_admin", "super_admin", "global_admin", "admin", "admin_escola", "staff_admin"].includes(r)) return "ADMIN";
  if (r === "formador" || r === "mentor" || r === "solo_admin" || r === "creator") return "MENTOR";
  if (r === "formando") return "ALUNO";
  return "SECRETARIA";
}

export function isCenterAdminDashboardType(type: TenantType): boolean {
  return type === "CENTER" || type === "K12";
}

export function shouldRedirectToK12FromFormacaoApp(
  tenantFromDb: "k12" | "formacao" | "solo_creator" | null | undefined
): boolean {
  return tenantFromDb === "k12";
}

export function isCriticalTenantMappingMismatch(
  tenantFromDb: string | null | undefined,
  mappedType: TenantType
): boolean {
  return String(tenantFromDb ?? "").trim().toLowerCase() === "formacao" && mappedType === "SOLO_CREATOR";
}

export const CENTER_NAV_CONFIG: NavItem[] = [
  {
    id: "dashboard-admin",
    href: "/admin/dashboard",
    icon: "LayoutDashboard",
    label: { default: "Dashboard" },
    allowedRoles: ["ADMIN"],
    group: "Gestão",
  },
  {
    id: "equipa",
    href: "/admin/equipa",
    icon: "Users",
    label: { default: "Equipa" },
    allowedRoles: ["ADMIN"],
    group: "Gestão",
  },
  {
    id: "dashboard-secretaria",
    href: "/secretaria/dashboard",
    icon: "LayoutDashboard",
    label: { default: "Secretaria" },
    allowedRoles: ["SECRETARIA", "ADMIN"],
    group: "Académico",
  },
  {
    id: "nova-inscricao",
    href: "/secretaria/inscricoes",
    icon: "UserPlus",
    label: { default: "Nova Inscrição" },
    allowedRoles: ["ADMIN", "SECRETARIA"],
    group: "Académico",
  },
  {
    id: "admissoes-web",
    href: "/admin/admissoes-web",
    icon: "Rocket",
    label: { default: "Admissões Web" },
    allowedRoles: ["ADMIN", "SECRETARIA"],
    group: "Académico",
  },
  {
    id: "catalogo-cursos",
    href: "/secretaria/catalogo-cursos",
    icon: "GraduationCap",
    label: { default: "Cursos" },
    allowedRoles: ["ADMIN", "SECRETARIA"],
    group: "Académico",
  },
  {
    id: "cohorts",
    href: "/secretaria/turmas",
    icon: "Users",
    label: { default: "Turmas Operacionais" },
    allowedRoles: ["ADMIN", "SECRETARIA"],
    group: "Académico",
  },
  {
    id: "certificados",
    href: "/secretaria/certificados",
    icon: "FileText",
    label: { default: "Certificados" },
    allowedRoles: ["ADMIN", "SECRETARIA"],
    group: "Académico",
  },
  {
    id: "inbox",
    href: "/secretaria/inbox",
    icon: "Inbox",
    label: { default: "Inbox Operacional" },
    allowedRoles: ["SECRETARIA", "ADMIN"],
    group: "Académico",
  },
  {
    id: "agenda",
    href: "/agenda",
    icon: "Calendar",
    label: { default: "Minha Agenda" },
    allowedRoles: ["MENTOR"],
    group: "Académico",
  },
  {
    id: "honorarios",
    href: "/honorarios",
    icon: "Wallet",
    label: { default: "Meus Honorários" },
    allowedRoles: ["MENTOR"],
    group: "Financeiro",
  },
  {
    id: "dashboard-aluno",
    href: "/aluno/dashboard",
    icon: "LayoutDashboard",
    label: { default: "Início" },
    allowedRoles: ["ALUNO"],
    group: "Gestão",
  },
  {
    id: "alunos",
    href: "/meus-cursos",
    icon: "GraduationCap",
    label: { default: "Meus Cursos" },
    allowedRoles: ["ALUNO"],
    group: "Académico",
  },
  {
    id: "pagamentos",
    href: "/pagamentos",
    icon: "CreditCard",
    label: { default: "Pagamentos" },
    allowedRoles: ["ALUNO"],
    group: "Financeiro",
  },
  {
    id: "financeiro",
    href: "/financeiro/dashboard",
    icon: "BadgeDollarSign",
    label: { default: "Financeiro & B2B" },
    allowedRoles: ["ADMIN"],
    group: "Financeiro",
  },
  {
    id: "subscricao",
    href: "/financeiro/subscricao",
    icon: "CreditCard",
    label: { default: "Assinatura" },
    allowedRoles: ["ADMIN"],
    group: "Financeiro",
  },
  {
    id: "onboarding",
    href: "/admin/onboarding",
    icon: "ClipboardCheck",
    label: { default: "Onboarding" },
    allowedRoles: ["ADMIN"],
    group: "Gestão",
  },
  {
    id: "publicacao",
    href: "/admin/publicacao",
    icon: "Globe2",
    label: { default: "Landing Pública" },
    allowedRoles: ["ADMIN", "SECRETARIA"],
    group: "Gestão",
  },
  {
    id: "infra",
    href: "/admin/infraestrutura",
    icon: "Building2",
    label: { default: "Salas & Infraestrutura" },
    allowedRoles: ["ADMIN"],
    group: "Gestão",
  }
];

export const SOLO_NAV_CONFIG: NavItem[] = [
  {
    id: "dashboard-mentor",
    href: "/mentor/dashboard",
    icon: "LayoutDashboard",
    label: { default: "Visão Geral" },
    allowedRoles: ["ADMIN", "MENTOR"],
    group: "Gestão",
  },
  {
    id: "mentorias",
    href: "/mentor/mentorias",
    icon: "Users",
    label: { default: "Mentorias & Eventos" },
    allowedRoles: ["ADMIN", "MENTOR"],
    group: "Académico",
  },
  {
    id: "nova-mentoria",
    href: "/mentor/mentorias/nova",
    icon: "Rocket",
    label: { default: "Lançar Mentoria" },
    allowedRoles: ["ADMIN", "MENTOR"],
    group: "Académico",
  },
  {
    id: "alunos",
    href: "/mentor/alunos",
    icon: "GraduationCap",
    label: { default: "Meus Alunos" },
    allowedRoles: ["ADMIN", "MENTOR"],
    group: "Académico",
  },
  {
    id: "vendas",
    href: "/mentor/vendas",
    icon: "BadgeDollarSign",
    label: { default: "Vendas" },
    allowedRoles: ["ADMIN", "MENTOR"],
    group: "Financeiro",
  },
];

export function getNavigationConfigForTenant(tenantType: TenantType): NavItem[] {
  if (tenantType === "SOLO_CREATOR") {
    return SOLO_NAV_CONFIG;
  }
  return CENTER_NAV_CONFIG;
}

/**
 * Filtra e resolve os labels da navegação com base no contexto.
 */
export function getAuthorizedNavigation(
  items: NavItem[],
  tenantType: TenantType,
  userRole: UserRole
) {
  return items
    .filter((item) => {
      // 1. Filtro por Tenant
      if (item.allowedTenantTypes && !item.allowedTenantTypes.includes(tenantType)) {
        return false;
      }
      // 2. Filtro por Role
      if (item.allowedRoles && !item.allowedRoles.includes(userRole)) {
        return false;
      }
      return true;
    })
    .map((item) => {
      // 3. Resolução de Micro-copy dinâmico
      let finalLabel = "";
      if (typeof item.label === "string") {
        finalLabel = item.label;
      } else {
        finalLabel = item.label[tenantType] || item.label.default || "";
      }

      return {
        id: item.id,
        href: item.href,
        icon: item.icon,
        label: finalLabel,
        group: item.group,
      };
    });
}
