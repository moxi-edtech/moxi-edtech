import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveSelectedStudentId } from "@/lib/portalAlunoAuth";
import { ACTIVE_MATRICULA_STATUSES } from "@/lib/matriculas/status";
import { selectApplicableOfficialEvents } from "@/lib/academic-calendar/visible-official-events";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Eventos MED correspondentes ao ano da matrícula e ao perfil educativo do
 * aluno autorizado. Um encarregado pode mudar de educando sem misturar anos.
 */
export async function GET(req: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.userId || !ctx.escolaId) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const studentId = new URL(req.url).searchParams.get("studentId");
    const alunoId = resolveSelectedStudentId({
      selectedId: studentId,
      authorizedIds: ctx.alunoIds,
      fallbackId: ctx.alunoId,
    });
    if (!alunoId) return NextResponse.json({ ok: true, items: [] });

    const { data: activeYear, error: yearError } = await supabase
      .from("anos_letivos")
      .select("id,ano")
      .eq("escola_id", ctx.escolaId)
      .eq("ativo", true)
      .maybeSingle();
    if (yearError) throw yearError;
    if (!activeYear) return NextResponse.json({ ok: true, items: [] });

    const { data: matricula, error: matriculaError } = await supabase
      .from("matriculas")
      .select("id,turma:turmas!inner(id,curso_id,classe_num)")
      .eq("escola_id", ctx.escolaId)
      .eq("aluno_id", alunoId)
      .eq("ano_letivo", activeYear.ano)
      .in("status", ACTIVE_MATRICULA_STATUSES)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (matriculaError) throw matriculaError;
    if (!matricula) return NextResponse.json({ ok: true, items: [] });

    const turma = (matricula as any).turma as { id: string; curso_id: string | null; classe_num: number | null } | null;
    if (!turma?.curso_id) return NextResponse.json({ ok: true, items: [] });

    const { data: offerings, error: offeringError } = await (supabase as any)
      .from("school_education_offerings")
      .select("id,calendar_profile_id")
      .eq("escola_id", ctx.escolaId)
      .eq("course_id", turma.curso_id)
      .eq("status", "active");
    if (offeringError) throw offeringError;

    const templateIds = Array.from(new Set(
      ((offerings ?? []) as Array<{ calendar_profile_id: string | null }>)
        .map((offer) => offer.calendar_profile_id)
        .filter((id): id is string => Boolean(id))
    ));
    // Sem perfil aplicável não há base segura para mostrar provas de outros
    // subsistemas (por exemplo exames do secundário a aluno pré-escolar).
    if (!templateIds.length) return NextResponse.json({ ok: true, items: [] });

    const today = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Africa/Luanda", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());

    // Os eventos comuns dos perfis MED são consolidados num único registo
    // por escola. Comparar também com os itens oficiais evita perder provas,
    // pausas e feriados só porque a origem gravada é de outro subsistema.
    const [
      { data: officialItems, error: itemsError },
      { data: events, error: eventsError },
    ] = await Promise.all([
      supabase
        .from("calendario_template_items")
        .select("nome,tipo,data_inicio,data_fim,applies_to_all_offerings,grade_codes")
        .in("template_id", templateIds)
        .neq("tipo", "PERIODO_LETIVO")
        .limit(500),
      supabase
        .from("calendario_eventos")
        .select("id,escola_id,nome,tipo,data_inicio,data_fim,cor_hex,ano_letivo_id,source_template_id,offering_id")
        .eq("escola_id", ctx.escolaId)
        .eq("ano_letivo_id", activeYear.id)
        .gte("data_fim", today)
        .order("data_inicio", { ascending: true })
        .order("id", { ascending: true })
        .limit(500),
    ]);
    if (itemsError || eventsError) throw itemsError || eventsError;
    if ((officialItems?.length ?? 0) >= 500 || (events?.length ?? 0) >= 500) {
      throw new Error("O calendário ultrapassou o limite de consulta. Solicite revisão do catálogo.");
    }

    const offeringIds = ((offerings ?? []) as Array<{ id: string }>).map((offer) => offer.id);
    const eligible = selectApplicableOfficialEvents(
      events ?? [],
      officialItems ?? [],
      offeringIds,
      turma.classe_num == null ? null : String(turma.classe_num),
    );

    return NextResponse.json({
      ok: true,
      items: eligible.slice(0, 3),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Não foi possível consultar o calendário.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
