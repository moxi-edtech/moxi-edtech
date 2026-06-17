import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveAuthorizedStudentIds, resolveSelectedStudentId } from "@/lib/portalAlunoAuth";

type Slot = {
  id: string;
  dia_semana: number;
  ordem: number;
  inicio: string;
  fim: string;
  is_intervalo: boolean;
};

type Assignment = {
  slot_id: string;
  disciplina: string;
  professor: string;
  sala: string;
};

type QuadroRow = {
  slot_id: string | null;
  disciplina?: { nome: string | null } | null;
  professor?: { profile_id: string | null } | null;
  sala?: { nome: string | null } | null;
  slot?: Slot | null;
};

export async function GET(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx || !ctx.escolaId) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    
    const { data: userRes } = await supabase.auth.getUser();
    const authorizedIds = await resolveAuthorizedStudentIds({
      supabase,
      userId: ctx.userId,
      escolaId: ctx.escolaId,
      userEmail: userRes?.user?.email,
    });

    const { searchParams } = new URL(request.url);
    const selectedId = searchParams.get("studentId");
    const alunoId = resolveSelectedStudentId({ selectedId, authorizedIds, fallbackId: ctx.alunoId });

    if (!alunoId) {
      return NextResponse.json({ ok: false, error: "Dados do aluno não encontrados" }, { status: 400 });
    }

    // Buscar matrícula ativa para este aluno específico
    const { data: matricula, error: matriculaError } = await supabase
      .from("matriculas")
      .select("id, turma_id")
      .eq("aluno_id", alunoId)
      .eq("escola_id", ctx.escolaId)
      .in('status', ['ativo', 'ativa', 'active'])
      .order('ano_letivo', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (matriculaError) throw matriculaError;

    const turmaId = matricula?.turma_id;

    if (!turmaId) {
      return NextResponse.json({ ok: true, version: null, slots: [], assignments: [] });
    }

    // 1. Buscar versão publicada do horário
    const { data: versaoData, error: versaoError } = await supabase
      .from("horario_versoes")
      .select("id")
      .eq("escola_id", ctx.escolaId)
      .eq("turma_id", turmaId)
      .eq("status", "publicada")
      .order("publicado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (versaoError) throw versaoError;

    const versao = versaoData as { id: string } | null;

    if (!versao) {
      return NextResponse.json({ ok: true, version: null, slots: [], assignments: [] });
    }

    // 2. Buscar o quadro oficial e os slots ligados por FK.
    const { data: quadroData, error: quadroError } = await supabase
      .from("quadro_horarios")
      .select(`
        slot_id,
        slot:horario_slots!inner(id, dia_semana, ordem, inicio, fim, is_intervalo),
        disciplina:disciplinas_catalogo(nome),
        professor:professores(profile_id),
        sala:salas(nome)
      `)
      .eq("escola_id", ctx.escolaId)
      .eq("turma_id", turmaId)
      .eq("versao_id", versao.id);

    if (quadroError) throw quadroError;

    const quadro = (quadroData || []) as QuadroRow[];
    const professorProfileIds = Array.from(
      new Set(
        quadro
          .map((q) => q.professor?.profile_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const professorNames = new Map<string, string>();

    if (professorProfileIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", professorProfileIds);

      for (const profile of profiles || []) {
        if (profile.user_id) professorNames.set(profile.user_id, profile.nome ?? "—");
      }
    }

    const slotMap = new Map<string, Slot>();
    for (const row of quadro) {
      if (row.slot?.id) slotMap.set(row.slot.id, row.slot);
    }

    const slots = Array.from(slotMap.values()).sort((a, b) => {
      if (a.dia_semana !== b.dia_semana) return a.dia_semana - b.dia_semana;
      return a.ordem - b.ordem;
    });

    const assignments = quadro.reduce<Assignment[]>((acc, q) => {
      if (!q.slot_id) return acc;
      acc.push({
        slot_id: q.slot_id,
        disciplina: q.disciplina?.nome ?? "—",
        professor: q.professor?.profile_id ? professorNames.get(q.professor.profile_id) ?? "—" : "—",
        sala: q.sala?.nome ?? "—",
      });
      return acc;
    }, []);

    return NextResponse.json({
      ok: true,
      version: versao.id,
      slots,
      assignments,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
