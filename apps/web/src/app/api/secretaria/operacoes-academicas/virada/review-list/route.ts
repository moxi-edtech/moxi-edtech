import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  to_session_id: z.string().uuid(),
});

type StudentRow = {
  id: string;
  aluno_id: string;
  turma_id: string | null;
  numero_matricula: string | number | null;
  status: string | null;
  alunos?: { id: string; nome: string | null; nome_completo: string | null } | null;
};

type TurmaRow = {
  id: string;
  nome: string | null;
  turno: string | null;
  classe_id: string | null;
  capacidade_maxima: number | null;
};

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    const authz = await authorizeEscolaAction(supabase as any, escolaId, user.id, ["configurar_escola"]);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });

    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Ano destino inválido" }, { status: 400 });

    const { data: targetSession } = await supabase
      .from("anos_letivos")
      .select("id,ano")
      .eq("id", parsed.data.to_session_id)
      .eq("escola_id", escolaId)
      .maybeSingle();
    if (!targetSession) return NextResponse.json({ ok: false, error: "Ano destino não encontrado" }, { status: 404 });

    const [{ data: matriculas, error: matriculasError }, { data: turmas, error: turmasError }] = await Promise.all([
      (supabase as any)
        .from("matriculas")
        .select("id,aluno_id,turma_id,numero_matricula,status,alunos:aluno_id(id,nome,nome_completo)")
        .eq("escola_id", escolaId)
        .eq("session_id", targetSession.id)
        .eq("ativo", true)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(500),
      (supabase as any)
        .from("turmas")
        .select("id,nome,turno,classe_id,capacidade_maxima")
        .eq("escola_id", escolaId)
        .eq("session_id", targetSession.id)
        .order("nome", { ascending: true })
        .order("id", { ascending: true })
        .limit(200),
    ]);

    if (matriculasError) throw matriculasError;
    if (turmasError) throw turmasError;

    const turmaRows = (turmas ?? []) as TurmaRow[];
    const turmaIds = turmaRows.map((turma) => turma.id);
    const { data: classes } = turmaIds.length
      ? await (supabase as any).from("classes").select("id,nome").eq("escola_id", escolaId)
      : { data: [] };
    const classNameById = new Map((classes ?? []).map((item: { id: string; nome: string | null }) => [item.id, item.nome]));
    const occupancy = new Map<string, number>();
    ((matriculas ?? []) as StudentRow[]).forEach((matricula) => {
      if (matricula.turma_id) occupancy.set(matricula.turma_id, (occupancy.get(matricula.turma_id) ?? 0) + 1);
    });

    return NextResponse.json({
      ok: true,
      target_session: targetSession,
      students: ((matriculas ?? []) as StudentRow[]).map((matricula) => ({
        matricula_id: matricula.id,
        aluno_id: matricula.aluno_id,
        nome: matricula.alunos?.nome_completo ?? matricula.alunos?.nome ?? "Aluno sem nome",
        turma_id: matricula.turma_id,
        numero_matricula: matricula.numero_matricula,
        status: matricula.status,
      })),
      turmas: turmaRows.map((turma) => ({
        id: turma.id,
        nome: turma.nome ?? "Turma sem nome",
        turno: turma.turno,
        classe_id: turma.classe_id,
        classe_nome: turma.classe_id ? classNameById.get(turma.classe_id) ?? null : null,
        capacidade_maxima: turma.capacidade_maxima,
        ocupacao_atual: occupancy.get(turma.id) ?? 0,
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno" }, { status: 500 });
  }
}
