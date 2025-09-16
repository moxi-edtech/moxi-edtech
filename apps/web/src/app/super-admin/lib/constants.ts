// apps/web/src/app/super-admin/lib/constants.ts
// Constantes mínimas para uso nas telas do Super Admin

export const SUPER_ADMIN_ROUTES = {
  dashboard: "/super-admin",
  escolas: "/super-admin/escolas",
  novaEscola: "/super-admin/escolas/nova",
  usuarios: "/super-admin/usuarios",
  financeiro: "/financeiro",
} as const;

export const ROLES = {
  superAdmin: "super_admin",
  admin: "admin",
  professor: "professor",
  aluno: "aluno",
  secretaria: "secretaria",
  financeiro: "financeiro",
} as const;

export type RoleKey = keyof typeof ROLES;
export type RoleValue = typeof ROLES[RoleKey];
