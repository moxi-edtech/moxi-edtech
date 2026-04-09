import { resolveFormacaoSessionContext } from "@/lib/session-context";

export type FormacaoRole =
  | "formacao_admin"
  | "formacao_secretaria"
  | "formacao_financeiro"
  | "formador"
  | "formando"
  | "super_admin"
  | "global_admin";

export type FormacaoAuthContext = {
  userId: string;
  role: FormacaoRole | null;
  tenantType: "k12" | "formacao" | null;
};

export async function getFormacaoAuthContext(): Promise<FormacaoAuthContext | null> {
  const session = await resolveFormacaoSessionContext();
  if (!session) return null;

  const roleRaw = String(session.role ?? "").trim().toLowerCase();
  const tenantRaw = String(session.tenantType ?? "")
    .trim()
    .toLowerCase();

  return {
    userId: session.userId,
    role: isFormacaoRole(roleRaw) ? roleRaw : null,
    tenantType: tenantRaw === "k12" || tenantRaw === "formacao" ? tenantRaw : null,
  };
}

export function getDefaultFormacaoPath(role: string | null | undefined): string {
  switch (role) {
    case "formacao_admin":
    case "super_admin":
    case "global_admin":
      return "/admin/dashboard";
    case "formacao_secretaria":
      return "/secretaria/catalogo-cursos";
    case "formacao_financeiro":
      return "/financeiro/dashboard";
    case "formador":
      return "/agenda";
    case "formando":
      return "/meus-cursos";
    default:
      return "/dashboard";
  }
}

export function canAccessFormacaoPath(role: string | null | undefined, pathname: string): boolean {
  const normalized = String(role ?? "").trim().toLowerCase();
  if (!normalized) return false;

  const isAdminRole =
    normalized === "formacao_admin" || normalized === "super_admin" || normalized === "global_admin";

  if (pathname.startsWith("/admin")) {
    return isAdminRole;
  }

  if (pathname.startsWith("/secretaria")) {
    return isAdminRole || normalized === "formacao_secretaria";
  }

  if (pathname.startsWith("/financeiro")) {
    return isAdminRole || normalized === "formacao_financeiro";
  }

  if (pathname.startsWith("/agenda") || pathname.startsWith("/honorarios")) {
    if (pathname.startsWith("/agenda")) {
      return isAdminRole || normalized === "formador";
    }
    return isAdminRole || normalized === "formador" || normalized === "formacao_financeiro";
  }

  if (
    pathname.startsWith("/meus-cursos") ||
    pathname.startsWith("/pagamentos") ||
    pathname.startsWith("/conquistas") ||
    pathname.startsWith("/loja-cursos")
  ) {
    return isAdminRole || normalized === "formando";
  }

  return true;
}

function isFormacaoRole(value: string): value is FormacaoRole {
  return [
    "formacao_admin",
    "formacao_secretaria",
    "formacao_financeiro",
    "formador",
    "formando",
    "super_admin",
    "global_admin",
  ].includes(value);
}
