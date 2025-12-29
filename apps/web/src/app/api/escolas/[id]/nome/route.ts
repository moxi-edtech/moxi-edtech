import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { parsePlanTier } from "@/config/plans";

// GET /api/escolas/[id]/nome
// Returns the escola display name using service role after authorization.
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await context.params;

  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    // Authorization: allow any user vinculado à escola; also allow admin/profiles-based link
    let allowed = false;

    // First, check for an active onboarding draft, which grants temporary permission.
    try {
      const { data: draft } = await s
        .from("onboarding_drafts")
        .select("id")
        .eq("escola_id", escolaId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (draft) allowed = true;
    } catch {}

    if (!allowed) {
      try {
        const { data: vinc } = await s
          .from("escola_users")
          .select("papel")
          .eq("escola_id", escolaId)
          .eq("user_id", user.id)
          .maybeSingle();
        const papel = (vinc as any)?.papel as string | undefined;
        // Qualquer vínculo concede leitura de identificação básica da escola
        if (!allowed) allowed = Boolean(papel);
      } catch {}
    }
    if (!allowed) {
      try {
        const { data: adminLink } = await s
          .from("escola_administradores")
          .select("user_id")
          .eq("escola_id", escolaId)
          .eq("user_id", user.id)
          .limit(1);
        allowed = Boolean(adminLink && (adminLink as any[]).length > 0);
      } catch {}
    }
    if (!allowed) {
      try {
        const { data: prof } = await s
          .from("profiles")
          .select("role, escola_id")
          .eq("user_id", user.id)
          .eq("escola_id", escolaId)
          .limit(1);

        if (prof && prof.length > 0) {
          const role = (prof[0] as any).role as string | undefined;
          if (role === "admin" || role === "financeiro" || role === "secretaria" || role === "gestor") {
            allowed = true;
          }
        }
      } catch {}
    }
    if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente." }, { status: 500 });
    }
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await (admin as any)
      .from("escolas")
      .select("nome, plano_atual, plano, status")
      .eq("id", escolaId)
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const row = data as any;
    return NextResponse.json({
      ok: true,
      nome: row?.nome ?? null,
      plano: row?.plano_atual ? parsePlanTier(row.plano_atual) : row?.plano ? parsePlanTier(row.plano) : null,
      status: row?.status ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
