import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { canManageEscolaResources } from "../../../permissions";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

const mapTurno = (turno: string | null) => {
  const normalized = (turno || "").toUpperCase();
  if (normalized === "M" || normalized === "MANHA" || normalized === "MANHÃ") return "Manhã";
  if (normalized === "T" || normalized === "TARDE") return "Tarde";
  if (normalized === "N" || normalized === "NOITE") return "Noite";
  return turno || "";
};

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string; cursoId: string }> }
) {
  const { id: escolaId, cursoId } = await context.params;

  try {
    const supabase = await createRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
    if (!userEscolaId || userEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const allowed = await canManageEscolaResources(supabase as any, escolaId, user.id);
    if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

    let turmasQuery = (supabase as any)
      .from("turmas")
      .select("id, nome, classe_id, turno, capacidade_maxima, status_validacao, classes(id, nome)")
      .eq("escola_id", escolaId)
      .eq("curso_id", cursoId)
      .eq("status_validacao", "ativo")
      .order("nome", { ascending: true });

    turmasQuery = applyKf2ListInvariants(turmasQuery, { defaultLimit: 50 });

    const { data: turmas, error: turmasError } = await turmasQuery;

    if (turmasError) throw turmasError;

    if (!turmas || turmas.length === 0) {
      return NextResponse.json({ ok: true, data: { turmas: [], alunos: [] } });
    }

    const turmaIds = turmas.map((t: any) => t.id);

    let matriculasQuery = (supabase as any)
      .from("matriculas")
      .select("id, turma_id, status, aluno:alunos(id, nome, bi_numero)")
      .in("turma_id", turmaIds)
      .eq("escola_id", escolaId)
      .eq("status", "ativo")
      .order("created_at", { ascending: false });

    matriculasQuery = applyKf2ListInvariants(matriculasQuery, { defaultLimit: 50 });

    const { data: matriculas, error: matriculasError } = await matriculasQuery;

    if (matriculasError) throw matriculasError;

    const turmasFormatadas = turmas.map((t: any) => {
      const totalAlunos = (matriculas || []).filter((m: any) => m.turma_id === t.id).length;
      return {
        id: t.id,
        nome: t.nome,
        classe_id: t.classe_id || t.classes?.id || null,
        classe: t.classes?.nome || "Classe Desconhecida",
        turno: mapTurno(t.turno),
        capacidade_maxima: t.capacidade_maxima || null,
        total_alunos: totalAlunos,
      };
    });

    const alunosFormatados = (matriculas || []).map((m: any) => ({
      id: m.aluno?.id,
      nome: m.aluno?.nome,
      turma_id: m.turma_id,
      bi: m.aluno?.bi_numero || null,
    }));

    return NextResponse.json({ ok: true, data: { turmas: turmasFormatadas, alunos: alunosFormatados } });
  } catch (error: any) {
    console.error("[course-details]", error);
    const message = error?.message || "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
