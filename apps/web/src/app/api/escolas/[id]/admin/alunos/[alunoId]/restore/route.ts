import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { recordAuditServer } from "@/lib/audit";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string; alunoId: string }> }) {
  const { id: escolaId, alunoId } = await ctx.params;
  try {
    const s = await supabaseServerTyped<any>();
    const { data: userRes } = await s.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const resolvedEscolaId = await resolveEscolaIdForUser(s, user.id, escolaId);
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const { data: prof } = await s.from('profiles').select('role').eq('user_id', user.id).maybeSingle();
    const globalRole = (prof as any)?.role as string | undefined;
    if (!['super_admin','global_admin'].includes(globalRole || '')) {
      const { data: vinc } = await s.from('escola_users').select('papel').eq('escola_id', escolaId).eq('user_id', user.id).limit(1);
      const papel = (vinc?.[0] as any)?.papel as string | undefined;
      if (papel !== 'admin') return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 });
    }

    // valida aluno pertence à escola
    const { data: aluno, error } = await s
      .from("alunos")
      .select("id, escola_id")
      .eq("id", alunoId)
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    if (!aluno) return NextResponse.json({ ok: false, error: "Aluno não encontrado" }, { status: 404 });
    if (String((aluno as any).escola_id) !== String(escolaId)) return NextResponse.json({ ok: false, error: "Aluno não pertence à escola" }, { status: 403 });

    const { error: updErr } = await s
      .from("alunos")
      .update({ deleted_at: null, deleted_by: null, deletion_reason: null, status: "pendente" } as any)
      .eq("id", alunoId);
    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });

    recordAuditServer({ escolaId, portal: "admin_escola", acao: "ALUNO_RESTAURADO", entity: "aluno", entityId: String(alunoId) }).catch(() => null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
