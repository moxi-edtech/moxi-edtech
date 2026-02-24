import { NextRequest, NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const url = new URL(req.url);
    const anoParam = url.searchParams.get("ano");
    const supabase = await supabaseServerTyped<Database>();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
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

    let anoLetivo = anoParam ? Number(anoParam) : null;
    if (!anoLetivo) {
      const { data: activeYear } = await (supabase as any)
        .from('anos_letivos')
        .select('ano')
        .eq('escola_id', userEscolaId)
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
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

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
