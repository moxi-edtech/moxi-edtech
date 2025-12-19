import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser, authorizeMatriculasManage } from "@/lib/escola/disciplinas";

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const headers = new Headers();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: 'Escola não encontrada' }, { status: 400 });
    }

    const authz = await authorizeMatriculasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 });

    headers.set('Deprecation', 'true');
    headers.set('Link', `</api/escolas/${escolaId}/matriculas>; rel="successor-version"`);

    const body = await req.json();
    const { status } = body;
    const { id: matricula_id } = await context.params;

    if (!status) {
      return NextResponse.json({ ok: false, error: 'status é obrigatório' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('matriculas')
      .update({ status })
      .eq('id', matricula_id)
      .eq('escola_id', escolaId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers });
    }

    return NextResponse.json({ ok: true }, { headers });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
