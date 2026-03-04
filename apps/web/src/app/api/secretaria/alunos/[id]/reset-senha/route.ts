import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { callAuthAdminJob } from "@/lib/auth-admin-job";
import { recordAuditServer } from "@/lib/audit";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const alunoId = id;
    if (!alunoId) {
      return NextResponse.json({ ok: false, error: "ID do aluno não fornecido" }, { status: 400 });
    }

    const s = await supabaseServerTyped<any>();
    const { data: userRes } = await s.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { data: prof, error: profErr } = await s
      .from("profiles")
      .select("role, escola_id, current_escola_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (profErr) {
      return NextResponse.json({ ok: false, error: profErr.message }, { status: 400 });
    }

    const role = (prof as any)?.role as string | undefined;
    const escolaFromProfile = (prof as any)?.current_escola_id || (prof as any)?.escola_id || null;
    const allowedRoles = ["super_admin", "admin", "secretaria", "secretaria_financeiro", "admin_financeiro"];

    if (!role || !allowedRoles.includes(role)) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    if (!escolaFromProfile) {
      return NextResponse.json({ ok: false, error: "Perfil não está vinculado a uma escola" }, { status: 403 });
    }

    const { data: aluno, error: alunoErr } = await s
      .from("alunos")
      .select("id, escola_id, usuario_auth_id, profile_id")
      .eq("id", alunoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (alunoErr) {
      return NextResponse.json({ ok: false, error: alunoErr.message }, { status: 400 });
    }
    if (!aluno) {
      return NextResponse.json({ ok: false, error: "Aluno não encontrado" }, { status: 404 });
    }

    const alunoEscolaId = (aluno as any).escola_id as string | null;
    if (!alunoEscolaId) {
      return NextResponse.json({ ok: false, error: "Aluno sem escola definida" }, { status: 400 });
    }

    if (String(alunoEscolaId) !== String(escolaFromProfile)) {
      return NextResponse.json({ ok: false, error: "Aluno não pertence à escola ativa do usuário" }, { status: 403 });
    }

    const userId = (aluno as any).usuario_auth_id || (aluno as any).profile_id || null;
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Aluno ainda não ativou o acesso" }, { status: 400 });
    }

    const login = `aluno_${alunoId}@${alunoEscolaId}.klasse.ao`.toLowerCase();
    const data = await callAuthAdminJob(req, "resetStudentPassword", { userId, login });

    const response = { ok: true, login: data?.login ?? login, senha: data?.senha };

    try {
      await recordAuditServer({
        escolaId: alunoEscolaId,
        portal: "secretaria",
        acao: "ALUNO_RESET_SENHA",
        entity: "aluno",
        entityId: String(alunoId),
        details: {
          performed_by: user.id,
          role,
          login: response.login,
        },
      });
    } catch {}

    return NextResponse.json(response);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
