import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";
import { AcademicYearContextError, assertAcademicYearEntity, resolveAcademicYearContext } from "@/lib/academic-year/context";
import { currentGradePeriod, gradePeriodState } from "@/lib/academico/grade-period-context";

const Params = z.object({
  ano_letivo_id: z.string().uuid(),
  turma_id: z.string().uuid(),
  turma_disciplina_id: z.string().uuid().optional(),
});

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });

    const url = new URL(req.url);
    const parsed = Params.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Turma e ano letivo inválidos." }, { status: 400 });

    const context = await resolveAcademicYearContext(supabase, {
      userId: user.id, requestedAcademicYearId: parsed.data.ano_letivo_id, operation: "READ",
    });
    await assertAcademicYearEntity(supabase, {
      table: "turmas", entityId: parsed.data.turma_id,
      escolaId: context.escolaId, anoLetivoId: context.anoLetivoId,
    });
    let activePeriods: number[] | null = null;
    if (parsed.data.turma_disciplina_id) {
      const { data: link, error: linkError } = await supabase
        .from("turma_disciplinas").select("id,periodos_ativos")
        .eq("id", parsed.data.turma_disciplina_id)
        .eq("turma_id", parsed.data.turma_id)
        .eq("escola_id", context.escolaId).maybeSingle();
      if (linkError) throw linkError;
      if (!link) return NextResponse.json({
        ok: false, code: "GRADE_DISCIPLINE_MISMATCH",
        error: "A disciplina não pertence à turma selecionada.",
      }, { status: 409 });
      if (Array.isArray(link.periodos_ativos) && link.periodos_ativos.length > 0) {
        activePeriods = link.periodos_ativos.map(Number);
      }
    }

    const { data, error } = await supabase.from("periodos_letivos")
      .select("id,numero,data_inicio,data_fim,trava_notas_em,source_template_id,offering_id")
      .eq("escola_id", context.escolaId)
      .eq("ano_letivo_id", context.anoLetivoId)
      .eq("tipo", "TRIMESTRE")
      .order("numero", { ascending: true }).limit(12);
    if (error) throw error;
    const periods = (data ?? []).map((row) => ({
      id: row.id, numero: Number(row.numero), data_inicio: row.data_inicio,
      data_fim: row.data_fim, trava_notas_em: row.trava_notas_em,
      source_template_id: row.source_template_id, offering_id: row.offering_id,
    }));

    // A single generic trimester per year is supported; offering-specific
    // calendars need explicit resolution instead of picking an arbitrary row.
    if (periods.length !== 3 || new Set(periods.map((row) => row.numero)).size !== 3 ||
      periods.some((row) => ![1, 2, 3].includes(row.numero) || row.offering_id !== null)) {
      return NextResponse.json({
        ok: false, code: "ACADEMIC_PERIOD_AMBIGUOUS",
        error: "Não foi possível confirmar os três trimestres desta turma. Solicite a conciliação do calendário.",
      }, { status: 409 });
    }

    // The 2026/27 MED cycle cannot use legacy, unlinked dates as authority.
    if (context.anoLetivoLabel.startsWith("2026/") &&
        periods.some((row) => !row.source_template_id)) {
      return NextResponse.json({
        ok: false, code: "OFFICIAL_CALENDAR_NOT_RECONCILED",
        error: "O calendário deste ano letivo precisa de ser sincronizado antes de lançar notas.",
      }, { status: 409 });
    }

    const now = new Date();
    const items = periods.map((row) => ({
      numero: row.numero,
      data_inicio: row.data_inicio,
      data_fim: row.data_fim,
      estado: gradePeriodState(row, now, context.timezone),
      calendar_verified: Boolean(row.source_template_id),
      disciplina_ativa: activePeriods === null || activePeriods.includes(row.numero),
    }));
    return NextResponse.json({
      ok: true, items,
      current_trimestre: activePeriods === null || activePeriods.includes(currentGradePeriod(periods, now, context.timezone) ?? -1)
        ? currentGradePeriod(periods, now, context.timezone) : null,
      read_only: context.mode !== "CURRENT",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: cause.message, code: cause.code }, { status: cause.status });
    }
    return NextResponse.json({ ok: false, error: "Não foi possível confirmar os trimestres desta matrícula." }, { status: 503 });
  }
}
