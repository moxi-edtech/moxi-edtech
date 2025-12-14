import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser, authorizeTurmasManage } from "@/lib/escola/disciplinas";

type AlunoTurmaRow = {
  matricula_id: string;
  aluno_id: string;
  numero_lista: number | null;
  status_matricula: string | null;

  aluno_nome: string | null;
  numero_login: string | null;
  bi_numero: string | null;
  data_nascimento: string | null;
  naturalidade: string | null;
  provincia: string | null;

  telefone_aluno: string | null;
  email_aluno: string | null;

  responsavel_nome: string | null;
  responsavel_telefone: string | null;
  responsavel_relacao: string | null;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const headers = new Headers();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: true, turmaId: null, total: 0, alunos: [] }, { headers });

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || 'Sem permissão' }, { status: 403 });

    headers.set('Deprecation', 'true');
    headers.set('Link', `</api/escolas/${escolaId}/turmas>; rel="successor-version"`);

    const { id: turmaId } = await params;

    const { data, error } = await supabase
      .from("matriculas")
      .select(
        `
        id,
        turma_id,
        status,
        numero_lista,
        aluno_id,
        alunos (
          id,
          nome,
          bi_numero,
          data_nascimento,
          naturalidade,
          provincia,
          telefone,
          email,
          responsavel,
          telefone_responsavel,
          encarregado_relacao,
          profiles (
            id,
            numero_login
          )
        )
      `
      )
      .eq("turma_id", turmaId)
      .eq("escola_id", escolaId)
      .order("numero_lista", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as any[];

    const alunos: AlunoTurmaRow[] = rows.map((mat, index) => {
      const aluno = Array.isArray(mat.alunos) ? mat.alunos[0] : mat.alunos;
      const profile = aluno?.profiles
        ? Array.isArray(aluno.profiles)
          ? aluno.profiles[0]
          : aluno.profiles
        : null;

      return {
        matricula_id: mat.id,
        aluno_id: aluno?.id ?? null,
        numero_lista: mat.numero_lista ?? index + 1,
        status_matricula: mat.status ?? null,

        aluno_nome: aluno?.nome ?? null,
        numero_login: profile?.numero_login ?? null,
        bi_numero: aluno?.bi_numero ?? null,
        data_nascimento: aluno?.data_nascimento ?? null,
        naturalidade: aluno?.naturalidade ?? null,
        provincia: aluno?.provincia ?? null,

        telefone_aluno: aluno?.telefone ?? null,
        email_aluno: aluno?.email ?? null,

        responsavel_nome: aluno?.responsavel ?? null,
        responsavel_telefone: aluno?.telefone_responsavel ?? null,
        responsavel_relacao: aluno?.encarregado_relacao ?? null,
      };
    });

    return NextResponse.json({
      ok: true,
      turmaId,
      total: alunos.length,
      alunos,
    }, { headers });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
