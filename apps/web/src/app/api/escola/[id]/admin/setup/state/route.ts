import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { applyKf2ListInvariants } from "@/lib/kf2";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const url = new URL(req.url);
    const anoParam = url.searchParams.get("ano");
    const supabase = await createRouteClient();

    let user: { id: string } | null = null;
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) {
        const status = (authError as { status?: number }).status;
        if (status === 400 || status === 401) {
          return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
        }
        return NextResponse.json({ ok: false, error: authError.message }, { status: 401 });
      }
      user = auth?.user ? { id: auth.user.id } : null;
    } catch {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
    if (!userEscolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const { data: hasRole, error: roleError } = await supabase.rpc('user_has_role_in_school', {
      p_escola_id: userEscolaId,
      p_roles: ['admin_escola', 'secretaria', 'admin'],
    });
    if (roleError) {
      return NextResponse.json({ ok: false, error: "Erro ao verificar permissões" }, { status: 500 });
    }
    if (!hasRole) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    let anoLetivo = anoParam ? Number(anoParam) : null;
    if (!anoLetivo) {
      let activeYearQuery = (supabase as any)
        .from('anos_letivos')
        .select('ano')
        .eq('escola_id', userEscolaId)
        .eq('ativo', true)

      activeYearQuery = applyKf2ListInvariants(activeYearQuery, {
        defaultLimit: 1,
        order: [{ column: 'created_at', ascending: false }],
      })

      const { data: activeYear } = await activeYearQuery.maybeSingle();
      anoLetivo = activeYear?.ano ?? null;
    }

    if (!anoLetivo) {
      return NextResponse.json({ ok: false, error: "Ano letivo ativo não encontrado" }, { status: 400 });
    }

    const { data, error } = await (supabase as any).rpc('get_setup_state', {
      p_escola_id: userEscolaId,
      p_ano_letivo: anoLetivo,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const badges = data?.badges ?? {};
    const setupSteps = [
      Boolean(badges.ano_letivo_ok),
      Boolean(badges.periodos_ok),
      Boolean(badges.avaliacao_ok),
      Boolean(badges.curriculo_published_ok),
      Boolean(badges.turmas_ok),
    ];
    const completionPercent = Math.round(
      (setupSteps.filter(Boolean).length / setupSteps.length) * 100
    );

    return NextResponse.json({
      ok: true,
      data: {
        ...data,
        completion_percent: completionPercent,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
