import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { supabaseServer } from "@/lib/supabaseServer";
import { canManageEscolaResources } from "../../../permissions";
import type { Database } from "~types/supabase";

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
    const supabase = await supabaseServer();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente." }, { status: 500 });
    }

    const admin = createAdminClient<Database>(supabaseUrl, serviceRoleKey);
    const allowed = await canManageEscolaResources(admin, escolaId, user.id);
    if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

    const { data: turmas, error: turmasError } = await (admin as any)
      .from("turmas")
      .select("id, nome, classe_id, turno, capacidade_maxima, status_validacao, classes(id, nome)")
      .eq("escola_id", escolaId)
      .eq("curso_id", cursoId)
      .eq("status_validacao", "ativo");

    if (turmasError) throw turmasError;

    if (!turmas || turmas.length === 0) {
      return NextResponse.json({ ok: true, data: { turmas: [], alunos: [] } });
    }

    const turmaIds = turmas.map((t: any) => t.id);

    const { data: matriculas, error: matriculasError } = await (admin as any)
      .from("matriculas")
      .select("id, turma_id, status, aluno:alunos(id, nome, bi_numero)")
      .in("turma_id", turmaIds)
      .eq("escola_id", escolaId)
      .eq("status", "ativo");

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
