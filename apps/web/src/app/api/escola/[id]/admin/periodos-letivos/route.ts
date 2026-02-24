import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const supabase = await createRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const userEscolaId = await resolveEscolaIdForUser(supabase, user.id, escolaId);
    if (!userEscolaId || userEscolaId !== escolaId) {
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

    const { data: anoLetivo } = await supabase
      .from('anos_letivos')
      .select('id, ano, data_inicio, data_fim, ativo')
      .eq('escola_id', userEscolaId)
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!anoLetivo) {
      return NextResponse.json({ ok: false, error: "Ano letivo ativo não encontrado" }, { status: 400 });
    }

    const { data: periodos, error } = await supabase
      .from('periodos_letivos')
      .select('id, tipo, numero, data_inicio, data_fim, trava_notas_em, peso')
      .eq('escola_id', userEscolaId)
      .eq('ano_letivo_id', anoLetivo.id)
      .order('numero', { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ano_letivo: anoLetivo, periodos: periodos ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
