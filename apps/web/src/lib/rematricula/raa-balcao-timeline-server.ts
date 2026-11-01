import { summarizeRaaBalcaoTimeline, type RaaBalcaoTimeline } from "@/lib/rematricula/raa-balcao-timeline";

/**
 * Read-only academic overview. It is deliberately separate from the RAA
 * eligibility decision and optional: a calendar lookup must never break the
 * payment/matrícula state endpoint.
 */
export async function loadRaaBalcaoAcademicTimeline(
  supabase: any,
  escolaId: string,
  matriculaOrigem: { id: string; session_id: string | null; turma_id: string | null },
): Promise<RaaBalcaoTimeline | null> {
  let academicTimeline: RaaBalcaoTimeline | null = null;
  try {
    if (matriculaOrigem.session_id && matriculaOrigem.turma_id) {
      const { data: sourceClass } = await supabase.from("turmas")
        .select("curso_id").eq("escola_id", escolaId)
        .eq("id", matriculaOrigem.turma_id).maybeSingle();
      const { data: sourceOfferings } = sourceClass?.curso_id
        ? await supabase.from("school_education_offerings").select("id")
            .eq("escola_id", escolaId).eq("course_id", sourceClass.curso_id).limit(2)
        : { data: null };
      const sourceOfferingId = sourceOfferings?.length === 1 ? sourceOfferings[0].id : null;
      const [periodsResult, eventsResult, examsResult, pautasResult, petitionsResult] = await Promise.all([
        supabase.from("periodos_letivos")
          .select("id,tipo,numero,data_inicio,data_fim,offering_id")
          .eq("escola_id", escolaId).eq("ano_letivo_id", matriculaOrigem.session_id).limit(100),
        supabase.from("calendario_eventos")
          .select("tipo,data_inicio,data_fim,offering_id")
          .eq("escola_id", escolaId).eq("ano_letivo_id", matriculaOrigem.session_id)
          .in("tipo", ["PROVA_TRIMESTRAL", "EXAME_NACIONAL", "EXAME_ORAL", "EXAME_ESCRITO", "EXAME_EXTRAORDINARIO"])
          .limit(100),
        supabase.from("exame_sessoes")
          .select("id,estado,data_inicio,data_fim")
          .eq("escola_id", escolaId).eq("ano_letivo_id", matriculaOrigem.session_id)
          .or("turma_id.is.null,turma_id.eq." + matriculaOrigem.turma_id).limit(40),
        supabase.from("pautas_oficiais")
          .select("status,pdf_path,periodo_letivo_id")
          .eq("escola_id", escolaId).eq("turma_id", matriculaOrigem.turma_id).limit(100),
        supabase.from("reapreciacao_pedidos")
          .select("id", { count: "exact", head: true })
          .eq("escola_id", escolaId).eq("matricula_id", matriculaOrigem.id),
      ]);
      if (!periodsResult.error && !eventsResult.error && !examsResult.error && !pautasResult.error) {
        type PeriodRecord = { id: string; tipo: string; numero: number; data_inicio: string; data_fim: string; offering_id: string | null };
        type EventRecord = { tipo: string; data_inicio: string; data_fim: string; offering_id: string | null };
        const pickOffering = <T extends { offering_id: string | null }>(items: T[] | null) => {
          const specific = sourceOfferingId
            ? (items ?? []).filter((item) => item.offering_id === sourceOfferingId) : [];
          return specific.length > 0 ? specific : (items ?? []).filter((item) => item.offering_id == null);
        };
        const sessoes = examsResult.data ?? [];
        const { data: resultados, error: resultsError } = sessoes.length
          ? await supabase.from("exame_resultados")
              .select("exame_sessao_id,nota,estado")
              .eq("escola_id", escolaId).eq("matricula_id", matriculaOrigem.id)
              .in("exame_sessao_id", sessoes.map((sessao: any) => sessao.id)).limit(200)
          : { data: [], error: null };
        if (!resultsError) {
          academicTimeline = summarizeRaaBalcaoTimeline({
            hoje: new Date().toLocaleDateString("sv-SE", { timeZone: "Africa/Luanda" }),
            periodos: pickOffering<PeriodRecord>((periodsResult.data ?? []) as PeriodRecord[]),
            eventos: pickOffering<EventRecord>((eventsResult.data ?? []) as EventRecord[]),
            sessoes,
            resultados: resultados ?? [],
            pautas: pautasResult.data ?? [],
            pedidosReapreciacao: petitionsResult.error ? null : petitionsResult.count ?? 0,
          });
        }
      }
    }
  } catch {
    return null;
  }
  return academicTimeline;
}
