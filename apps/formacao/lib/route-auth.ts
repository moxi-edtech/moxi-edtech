import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveFormacaoSessionContext } from "@/lib/session-context";

export async function requireFormacaoRoles(roles: string[]) {
  const supabase = await supabaseServer();
  const session = await resolveFormacaoSessionContext();

  if (!session?.userId) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }),
      supabase,
      userId: null,
      escolaId: null,
      role: null,
    };
  }

  const role = String(session.role ?? "")
    .trim()
    .toLowerCase();
  const tenantType = String(session.tenantType ?? "")
    .trim()
    .toLowerCase();
  const escolaId = String(session.tenantId ?? "").trim();

  if (!escolaId) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Escola não resolvida" }, { status: 400 }),
      supabase,
      userId: session.userId,
      escolaId: null,
      role,
    };
  }

  if (tenantType === "k12") {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Tenant incompatível para Formação" }, { status: 403 }),
      supabase,
      userId: session.userId,
      escolaId,
      role,
    };
  }

  if (!roles.includes(role)) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 }),
      supabase,
      userId: session.userId,
      escolaId,
      role,
    };
  }

  return {
    ok: true as const,
    response: null,
    supabase,
    userId: session.userId,
    escolaId,
    role,
  };
}

/**
 * Verifica se o utilizador tem acesso à turma específica.
 * Admins e Secretaria têm acesso total.
 * Formadores só têm acesso se estiverem vinculados à turma.
 */
export async function assertCohortAccess(
  supabase: any,
  userId: string,
  escolaId: string,
  role: string,
  cohortId: string
) {
  const r = String(role ?? "").trim().toLowerCase();
  
  // Papeis administrativos têm acesso irrestrito
  if (["formacao_admin", "formacao_secretaria", "super_admin", "global_admin"].includes(r)) {
    return { ok: true as const, response: null };
  }

  if (r === "formador") {
    const { data, error } = await supabase
      .from("formacao_cohort_formadores")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("cohort_id", cohortId)
      .eq("formador_user_id", userId)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return {
        ok: false as const,
        response: NextResponse.json(
          { ok: false, error: "Acesso negado: você não está atribuído a esta turma." },
          { status: 403 }
        ),
      };
    }
    return { ok: true as const, response: null };
  }

  return {
    ok: false as const,
    response: NextResponse.json({ ok: false, error: "Papel sem permissão de acesso à turma." }, { status: 403 }),
  };
}
