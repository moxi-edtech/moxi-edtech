import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveSelectedStudentId } from "@/lib/portalAlunoAuth";
import { resolveBoletimMatricula } from "@/lib/aluno/resolveBoletimMatricula";
import { resolveStudentTimetableTurma } from "@/lib/aluno/resolveStudentTimetableTurma";
import { AcademicYearContextError } from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function privateResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function emptyHorario(
  context: { anoLetivoId: string; anoLetivoLabel: string; mode: string },
  reason: "NO_ENROLLMENT" | "NO_CLASS" | "NOT_PUBLISHED",
) {
  return privateResponse({ ok: true, context, reason, version: null, slots: [], assignments: [] });
}

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
    if (!ctx?.escolaId || !ctx.userId) {
      return privateResponse({ ok: false, error: "Não autenticado." }, 401);
    }

    const authorizedIds = ctx.alunoIds;
    const params = new URL(request.url).searchParams;
    const requestedId = params.get("studentId");
    // Não aceitar implicitamente outro educando quando o ID pedido não é autorizado.
    if (requestedId && !ctx.alunoIds.includes(requestedId)) {
      return privateResponse({ ok: false, error: "Aluno não autorizado." }, 403);
    }
    const alunoId = resolveSelectedStudentId({
      selectedId: requestedId,
      authorizedIds,
      fallbackId: ctx.alunoId,
    });
    if (!alunoId) {
      return privateResponse({
        ok: true, reason: "NO_ENROLLMENT", version: null, slots: [], assignments: [],
      });
    }

    // Usar a mesma fonte de matrícula/ano da agenda e do boletim.
    // Uma matrícula encerrada pode ser consultada, mas nunca é substituída pela ativa.
    const { matricula, context } = await resolveBoletimMatricula(supabase, {
      escolaId: ctx.escolaId,
      alunoId,
      userId: ctx.userId,
      anoLetivoId: params.get("ano_letivo_id"),
      operation: "READ",
    });

    const { turmaId, reason } = await resolveStudentTimetableTurma(supabase, {
      escolaId: ctx.escolaId,
      anoLetivoId: context.anoLetivoId,
      matricula,
    });
    if (!turmaId) return emptyHorario(context, reason ?? "NO_ENROLLMENT");

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

    if (!versao) return emptyHorario(context, "NOT_PUBLISHED");

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

    return privateResponse({
      ok: true,
      context: {
        anoLetivoId: context.anoLetivoId,
        anoLetivoLabel: context.anoLetivoLabel,
        mode: context.mode,
      },
      reason: null,
      version: versao.id,
      slots,
      assignments,
    });
  } catch (error) {
    if (error instanceof AcademicYearContextError) {
      return privateResponse({ ok: false, code: error.code, error: error.message }, error.status);
    }
    return privateResponse({ ok: false, error: "Não foi possível consultar o horário." }, 503);
  }
}
