import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

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

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 });

    headers.set('Deprecation', 'true');
    headers.set('Link', `</api/escolas/${escolaId}/turmas>; rel="successor-version"`);

    const body = await req.json();
    const { diretor_turma_id } = body;
    const { id: turma_id } = await context.params;

    if (!diretor_turma_id) {
      return NextResponse.json({ ok: false, error: 'diretor_turma_id é obrigatório' }, { status: 400 });
    }

    const { data: turmaCheck, error: turmaError } = await supabase
      .from('turmas')
      .select('id')
      .eq('id', turma_id)
      .eq('escola_id', escolaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (turmaError) {
      return NextResponse.json({ ok: false, error: turmaError.message }, { status: 400, headers });
    }

    if (!turmaCheck) {
      return NextResponse.json({ ok: false, error: 'Turma não encontrada' }, { status: 404, headers });
    }

    const { data, error } = await supabase
      .from('turmas')
      .update({ diretor_turma_id })
      .eq('id', turma_id)
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
