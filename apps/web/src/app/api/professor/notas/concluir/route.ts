import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import {
  AcademicYearContextError,
  assertAcademicYearEntity,
  resolveAcademicYearContext,
} from "@/lib/academic-year/context";
import { resolveProfessorAcademicContext } from "@/lib/professor/resolveProfessorAcademicContext";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const Body = z.object({
  ano_letivo_id: z.string().uuid(),
  turma_id: z.string().uuid(),
  disciplina_id: z.string().uuid(),
  turma_disciplina_id: z.string().uuid(),
  trimestre: z.number().int().min(1).max(3),
});

// Saving grades never completes a register or emits inbox notifications.
// The PostgreSQL RPC validates the *entire* active roster and the canonical
// assessment components before its unique completion insert emits one event.
export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Contexto da pauta inválido." }, { status: 400 });
    }
    const body = parsed.data;
    const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada." }, { status: 403 });
    }

    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: auth.user.id,
      requestedAcademicYearId: body.ano_letivo_id,
      operation: "WRITE",
    });
    await assertAcademicYearEntity(supabase, {
      table: "turmas",
      entityId: body.turma_id,
      escolaId: academicContext.escolaId,
      anoLetivoId: academicContext.anoLetivoId,
    });

    const assignment = await resolveProfessorAcademicContext({
      supabase,
      escolaId,
      userId: auth.user.id,
      turmaId: body.turma_id,
      disciplinaId: body.disciplina_id,
      turmaDisciplinaId: body.turma_disciplina_id,
    });
    if (!assignment || assignment.turmaDisciplinaId !== body.turma_disciplina_id) {
      return NextResponse.json({ ok: false, error: "Esta disciplina não está atribuída ao professor." }, { status: 403 });
    }

    const { data: periods, error: periodError } = await supabase
      .from("periodos_letivos")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("ano_letivo_id", academicContext.anoLetivoId)
      .eq("tipo", "TRIMESTRE")
      .eq("numero", body.trimestre)
      .is("offering_id", null)
      .limit(2);
    if (periodError || periods?.length !== 1) {
      return NextResponse.json({
        ok: false,
        error: "O trimestre desta turma não está configurado de forma inequívoca.",
      }, { status: 409 });
    }

    const { data, error } = await supabase.rpc("concluir_pauta_trimestral" as any, {
      p_escola_id: escolaId,
      p_turma_disciplina_id: body.turma_disciplina_id,
      p_periodo_letivo_id: periods[0].id,
    } as any);

    if (error) {
      return NextResponse.json({
        ok: false,
        error: error.message ?? "Não foi possível concluir o lançamento.",
        code: error.code,
      }, { status: error.code === "42501" ? 403 : error.code === "P0001" ? 409 : 503 });
    }

    return NextResponse.json({
      ok: true,
      already_completed: Boolean((data as any)?.already_completed),
      total_alunos: (data as any)?.total_alunos ?? null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: cause.message, code: cause.code }, { status: cause.status });
    }
    console.error("[pauta-concluir] falha", cause);
    return NextResponse.json({ ok: false, error: "Não foi possível concluir o lançamento." }, { status: 500 });
  }
}
