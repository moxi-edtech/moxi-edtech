import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { recordAuditServer } from "@/lib/audit";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const alunoId = id;
    if (!alunoId) return NextResponse.json({ ok: false, error: 'ID do aluno não fornecido' }, { status: 400 })

    const s = await supabaseServerTyped<any>();
    const { data: userRes } = await s.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

    const { data: prof, error: profErr } = await s
      .from('profiles')
      .select('role, escola_id, current_escola_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (profErr) return NextResponse.json({ ok: false, error: profErr.message }, { status: 400 })
    const role = (prof as any)?.role as string | undefined
    const escolaFromProfile = (prof as any)?.current_escola_id || (prof as any)?.escola_id || null

    const allowedRoles = ['super_admin','global_admin','admin','staff_admin','secretaria']
    if (!role || !allowedRoles.includes(role)) return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 })
    if (!escolaFromProfile) return NextResponse.json({ ok: false, error: 'Perfil não está vinculado a uma escola' }, { status: 403 })

    // Verifica o aluno e escopo
    const { data: aluno, error: alunoErr } = await s
      .from('alunos')
      .select('id, escola_id, deleted_at')
      .eq('id', alunoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (alunoErr) return NextResponse.json({ ok: false, error: alunoErr.message }, { status: 400 })
    if (!aluno) return NextResponse.json({ ok: false, error: 'Aluno não encontrado' }, { status: 404 })
    if (String((aluno as any).escola_id) !== String(escolaFromProfile)) return NextResponse.json({ ok: false, error: 'Aluno não pertence à escola ativa do usuário' }, { status: 403 })

    const { error: updErr } = await s
      .from('alunos')
      .update({ deleted_at: null, deleted_by: null, deletion_reason: null, status: 'ativo' } as any)
      .eq('id', alunoId)
    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 })

    try {
      await recordAuditServer({
        escolaId: (aluno as any).escola_id,
        portal: 'secretaria',
        acao: 'ALUNO_RESTAURADO',
        entity: 'aluno',
        entityId: String(alunoId),
        details: { performed_by: user.id, role }
      })
    } catch {}

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
