import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;
  try {
    const supabase = await createRouteClient();
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

    const { data: anoLetivo } = await (supabase as any)
      .from('anos_letivos')
      .select('id, ano')
      .eq('escola_id', userEscolaId)
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!anoLetivo) {
      return NextResponse.json({ ok: false, error: "Ano letivo ativo não encontrado" }, { status: 400 });
    }

    const { data: curriculos, error } = await (supabase as any)
      .from('curso_curriculos')
      .select('id, curso_id, status, version, ano_letivo_id')
      .eq('escola_id', userEscolaId)
      .eq('ano_letivo_id', anoLetivo.id)
      .order('version', { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const byCurso = new Map<string, any>();
    (curriculos ?? []).forEach((row: any) => {
      if (!byCurso.has(row.curso_id)) {
        byCurso.set(row.curso_id, row);
      }
    });

    return NextResponse.json({
      ok: true,
      ano_letivo: anoLetivo,
      curriculos: Array.from(byCurso.values()),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
