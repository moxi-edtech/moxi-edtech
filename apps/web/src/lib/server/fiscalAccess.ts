import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export const FISCAL_COMPANY_ALLOWED_ROLES = ["owner", "admin", "operator"] as const;
export const FISCAL_SCHOOL_ALLOWED_ROLES = [
  "financeiro",
  "secretaria_financeiro",
  "admin_financeiro",
  "admin",
  "admin_escola",
  "staff_admin",
] as const;

export async function requireFiscalAccessByCompanyOrSchool({
  supabase,
  userId,
  empresaId,
  escolaId,
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  empresaId: string;
  escolaId: string | null;
}) {
  const { data: membership, error } = await supabase
    .from("fiscal_empresa_users")
    .select("role")
    .eq("empresa_id", empresaId)
    .eq("user_id", userId)
    .in("role", [...FISCAL_COMPANY_ALLOWED_ROLES])
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      status: 500,
      code: "FISCAL_AUTH_CHECK_FAILED",
      message: error.message || "Falha ao validar acesso fiscal.",
    };
  }

  const { data: binding, error: bindingError } = escolaId
    ? await supabase
        .from("fiscal_escola_bindings")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("escola_id", escolaId)
        .is("effective_to", null)
        .limit(1)
        .maybeSingle()
    : { data: null, error: null };

  if (bindingError) {
    return {
      ok: false as const,
      status: 500,
      code: "FISCAL_BINDING_CHECK_FAILED",
      message: bindingError.message || "Falha ao validar vínculo escola→empresa fiscal.",
    };
  }

  if (membership) {
    if (escolaId && !binding) {
      return {
        ok: false as const,
        status: 403,
        code: "FISCAL_ESCOLA_BINDING_NOT_FOUND",
        message: "A escola actual do utilizador não está vinculada à empresa fiscal informada.",
      };
    }
    return { ok: true as const };
  }

  if (!escolaId) {
    return {
      ok: false as const,
      status: 403,
      code: "FORBIDDEN",
      message: "Sem acesso fiscal à empresa informada.",
    };
  }

  const { data: hasSchoolRole, error: schoolRoleError } = await supabase.rpc("user_has_role_in_school", {
    p_escola_id: escolaId,
    p_roles: [...FISCAL_SCHOOL_ALLOWED_ROLES],
  });

  if (schoolRoleError) {
    return {
      ok: false as const,
      status: 500,
      code: "FISCAL_AUTH_CHECK_FAILED",
      message: schoolRoleError.message || "Falha ao validar papel fiscal da escola.",
    };
  }

  if (!binding) {
    return {
      ok: false as const,
      status: 403,
      code: "FISCAL_ESCOLA_BINDING_NOT_FOUND",
      message: "A escola actual do utilizador não está vinculada à empresa fiscal informada.",
    };
  }

  if (!hasSchoolRole) {
    return {
      ok: false as const,
      status: 403,
      code: "FORBIDDEN",
      message: "Sem acesso fiscal à empresa informada.",
    };
  }

  return { ok: true as const };
}
