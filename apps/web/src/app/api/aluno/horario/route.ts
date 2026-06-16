import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveAuthorizedStudentIds, resolveSelectedStudentId } from "@/lib/portalAlunoAuth";
import type { Database } from "~types/supabase";

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
    const { data: matricula } = await supabase
      .from("matriculas")
      .select("id, turma_id")
      .eq("aluno_id", alunoId)
      .eq("escola_id", ctx.escolaId)
      .in('status', ['ativo', 'ativa', 'active'])
      .order('ano_letivo', { ascending: false })
      .limit(1)
      .maybeSingle();

    const turmaId = matricula?.turma_id;

    if (!turmaId) {
      return NextResponse.json({ ok: true, version: null, slots: [], assignments: [] });
    }

    // 1. Buscar versão publicada do horário
    const { data: versaoData } = await supabase
      .from("horario_versoes" as any)
      .select("id, turno_id")
      .eq("escola_id", ctx.escolaId)
      .eq("turma_id", turmaId)
      .eq("status", "publicada")
      .order("publicado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    const versao = versaoData as { id: string; turno_id: string } | null;

    if (!versao) {
      return NextResponse.json({ ok: true, version: null, slots: [], assignments: [] });
    }

    // 2. Buscar todos os slots para o turno da turma
    const { data: slots } = await supabase
      .from("horario_slots")
      .select("id, dia_semana, ordem, inicio, fim, is_intervalo")
      .eq("escola_id", ctx.escolaId)
      .eq("turno_id", versao.turno_id)
      .order("ordem", { ascending: true })
      .order("dia_semana", { ascending: true });

    // 3. Buscar o quadro de horários (disciplinas e professores)
    const { data: quadro } = await supabase
      .from("quadro_horarios")
      .select(`
        slot_id,
        disciplina:disciplinas_catalogo(nome),
        professor:professores(profile:profiles(nome)),
        sala:salas(nome)
      `)
      .eq("escola_id", ctx.escolaId)
      .eq("turma_id", turmaId)
      .eq("versao_id", versao.id);

    const assignments: Assignment[] = (quadro || []).map((q: any) => ({
      slot_id: q.slot_id,
      disciplina: q.disciplina?.nome ?? "—",
      professor: q.professor?.profile?.nome ?? "—",
      sala: q.sala?.nome ?? "—",
    }));

    return NextResponse.json({
      ok: true,
      version: versao.id,
      slots: slots || [],
      assignments,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
