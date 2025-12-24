import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { recordAuditServer } from "@/lib/audit";

export async function POST(req: Request, context: { params: { id: string; alunoId: string } }) {
  const { id: escolaId, alunoId } = context.params;
  try {
    const body = await req.json().catch(() => ({} as any));
    const reason: string = (body?.reason as string | undefined)?.trim() || "Aluno arquivado (admin)";

    const s = await supabaseServerTyped<any>();
    const { data: userRes } = await s.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    // autorização: super/global admin ou admin da escola
    const { data: prof } = await s.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
    const globalRole = (prof as any)?.role as string | undefined;
    if (!['super_admin','global_admin'].includes(globalRole || '')) {
      const { data: vinc } = await s.from('escola_users').select('papel').eq('escola_id', escolaId).eq('user_id', user.id).limit(1);
      const papel = (vinc?.[0] as any)?.papel as string | undefined;
      if (papel !== 'admin') return NextResponse.json({ ok: false, error: 'Sem permissão' }, { status: 403 });
    }

    // valida aluno e escola (RLS garante escopo)
    const { data: aluno, error: alunoErr } = await s
      .from("alunos")
      .select("id, escola_id")
      .eq("id", alunoId)
      .maybeSingle();
    if (alunoErr) return NextResponse.json({ ok: false, error: alunoErr.message }, { status: 400 });
    if (!aluno) return NextResponse.json({ ok: false, error: "Aluno não encontrado" }, { status: 404 });
    if (String((aluno as any).escola_id) !== String(escolaId)) {
      return NextResponse.json({ ok: false, error: "Aluno não pertence à escola" }, { status: 403 });
    }

    const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!adminUrl || !serviceRole) return NextResponse.json({ ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    const admin = createAdminClient<Database>(adminUrl, serviceRole);

    const { error: rpcError } = await admin.rpc('soft_delete_aluno', {
      p_id: alunoId,
      p_deleted_by: user.id,
      p_reason: reason,
    });

    if (rpcError) {
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 400 });
    }

    recordAuditServer({ escolaId, portal: "admin_escola", acao: "ALUNO_ARQUIVADO", entity: "aluno", entityId: String(alunoId), details: { reason } }).catch(() => null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

