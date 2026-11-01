/**
 * Informational academic timeline for the source enrolment. No phase or
 * published document ever authorizes rematrícula: only the RAA does that.
 * Date inputs are official Angola-local YYYY-MM-DD calendar values.
 */
export type RaaBalcaoTimeline = {
  fase: "primeiro" | "segundo" | "terceiro" | "intervalo" | "antes_inicio" | "apos_fim" | "desconhecida";
  faseLabel: string;
  proximaEtapa: string;
  provas: "agendadas" | "em_curso" | "datas_decorridas" | "sem_calendario";
  proximaProvaEm: string | null;
  pautaFinalPublicada: boolean;
  publicacaoPautaPrevistaEm: string | null;
  exames: "sem_sessao" | "agendados" | "com_notas" | "notas_pendentes";
  notasExameRegistadas: number;
  pedidosReapreciacao: number | null;
};

type Periodo = { id?: string; tipo: string; numero: number; data_inicio: string; data_fim: string };
type Evento = { tipo: string; data_inicio: string; data_fim: string };
type Sessao = { id: string; estado: string; data_inicio: string; data_fim: string };
type Resultado = { exame_sessao_id: string; nota: number | null; estado: string };

const PROVAS = new Set(["PROVA_TRIMESTRAL", "EXAME_NACIONAL", "EXAME_ORAL", "EXAME_ESCRITO", "EXAME_EXTRAORDINARIO"]);

/**
 * School-wide calendar items coexist with the student's own offering.
 * A specific instance replaces the shared copy only when both represent
 * the SAME canonical event (source_item_id), or a truly identical legacy item.
 * Never remove independent school-wide events or include another offering.
 */
export function selectApplicableCalendarRecords<T extends {
  offering_id: string | null;
  source_item_id?: string | null;
  tipo?: string;
  nome?: string | null;
  data_inicio?: string;
  data_fim?: string;
}>(records: readonly T[], offeringId: string | null): T[] {
  const scoped = records.filter((record) =>
    record.offering_id === null || (offeringId !== null && record.offering_id === offeringId));
  const selected = new Map<string, T>();
  scoped.forEach((record, index) => {
    const sourceId = record.source_item_id?.trim();
    const name = record.nome?.trim();
    // Fallback is safe only for exact duplicates; same dates and type alone
    // may represent distinct exams, which must remain visible separately.
    const key = sourceId
      ? "source:" + record.tipo + ":" + sourceId
      : name && record.tipo && record.data_inicio && record.data_fim
        ? "legacy:" + [record.tipo, name, record.data_inicio, record.data_fim].join(":")
        : "row:" + index;
    const previous = selected.get(key);
    if (!previous || (record.offering_id === offeringId && previous.offering_id === null)) {
      selected.set(key, record);
    }
  });
  return Array.from(selected.values());
}

/** An offering-specific trimester overrides its school-wide counterpart, one period at a time. */
export function selectApplicablePeriods<T extends { offering_id: string | null; tipo: string; numero: number | string }>(
  records: readonly T[], offeringId: string | null,
): T[] {
  const applicable = selectApplicableCalendarRecords(records, offeringId);
  const overrides = new Set(applicable
    .filter((p) => offeringId !== null && p.offering_id === offeringId)
    .map((p) => p.tipo.toUpperCase() + ":" + Number(p.numero)));
  return applicable.filter((p) => p.offering_id !== null ||
    !overrides.has(p.tipo.toUpperCase() + ":" + Number(p.numero)));
}

function displayDate(date: string): string {
  const [year, month, day] = date.slice(0, 10).split("-");
  return day && month && year ? day + "/" + month + "/" + year : date;
}

export function summarizeRaaBalcaoTimeline(input: {
  hoje: string;
  periodos: readonly Periodo[];
  eventos: readonly Evento[];
  sessoes: readonly Sessao[];
  resultados: readonly Resultado[];
  pautas: readonly { status: string; pdf_path: string | null; periodo_letivo_id: string | null }[];
  pedidosReapreciacao?: number | null;
}): RaaBalcaoTimeline {
  const { hoje } = input;
  const periodos = input.periodos
    .filter((p) => p.tipo === "TRIMESTRE" && [1, 2, 3].includes(Number(p.numero)) &&
      !!p.data_inicio && !!p.data_fim && p.data_inicio <= p.data_fim)
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
  const activePeriods = periodos.filter((p) => p.data_inicio <= hoje && hoje <= p.data_fim);
  // Overlapping published periods cannot produce a trustworthy current trimester.
  const ativo = activePeriods.length === 1 ? activePeriods[0] : undefined;
  const seguinte = periodos.find((p) => p.data_inicio > hoje);
  const anterior = [...periodos].reverse().find((p) => p.data_fim < hoje);
  const fase = activePeriods.length > 1 ? "desconhecida"
    : ativo
    ? (ativo.numero === 1 ? "primeiro" : ativo.numero === 2 ? "segundo" : "terceiro")
    : seguinte && !anterior ? "antes_inicio"
    : seguinte ? "intervalo"
    : anterior ? "apos_fim" : "desconhecida";
  const labels = {
    primeiro: "1.º trimestre em curso",
    segundo: "2.º trimestre em curso",
    terceiro: "3.º trimestre em curso",
    intervalo: "Entre trimestres",
    antes_inicio: "Ano letivo por iniciar",
    apos_fim: "Períodos letivos terminados",
    desconhecida: "Período por confirmar",
  } as const;
  const provas = input.eventos
    .filter((e) => PROVAS.has(e.tipo) && e.data_inicio && e.data_fim)
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
  const provaAtual = provas.find((e) => e.data_inicio <= hoje && hoje <= e.data_fim);
  const provaFutura = provas.find((e) => e.data_inicio > hoje);
  const estadoProvas: RaaBalcaoTimeline["provas"] = provaAtual ? "em_curso"
    : provaFutura ? "agendadas" : provas.length > 0 ? "datas_decorridas" : "sem_calendario";

  // Only a successful, stored *final-period* official pauta is evidence of
  // final publication. A first/second-trimester pauta is not a final result.
  const finalPeriodIds = new Set(periodos.filter((p) => p.numero === 3).map((p) => p.id).filter(Boolean));
  const pautaFinalPublicada = input.pautas.some((p) =>
    p.status === "SUCCESS" && !!p.pdf_path?.trim() &&
    !!p.periodo_letivo_id && finalPeriodIds.has(p.periodo_letivo_id));

  const sessaoIds = new Set(input.sessoes.map((s) => s.id));
  const notasExameRegistadas = input.resultados.filter((r) =>
    sessaoIds.has(r.exame_sessao_id) && r.nota != null && Number.isFinite(Number(r.nota))).length;
  const exames = input.sessoes.length === 0 ? "sem_sessao"
    : notasExameRegistadas > 0 ? "com_notas"
    : input.sessoes.some((s) => s.data_inicio > hoje) ? "agendados" : "notas_pendentes";

  const upcoming = [
    ...(seguinte ? [{ date: seguinte.data_inicio, label: "Início do " + seguinte.numero + ".º trimestre" }] : []),
    ...(provaFutura ? [{ date: provaFutura.data_inicio, label: "Próxima prova" }] : []),
    ...input.eventos.filter((e) => e.data_inicio > hoje &&
      (e.tipo === "PUBLICACAO_PAUTA" || e.tipo === "CONSELHO_CLASSE"))
      .map((e) => ({ date: e.data_inicio, label: e.tipo === "PUBLICACAO_PAUTA"
        ? "Publicação da pauta prevista" : "Conselho de classe previsto" })),
    ...input.sessoes
      .filter((s) => s.data_inicio > hoje)
      .map((s) => ({ date: s.data_inicio, label: "Próximo exame" })),
  ].sort((a, b) => a.date.localeCompare(b.date))[0];

  const publicacaoPautaPrevistaEm = input.eventos
    .filter((event) => event.tipo === "PUBLICACAO_PAUTA" && event.data_inicio > hoje)
    .map((event) => event.data_inicio)
    .sort()[0] ?? null;

  const proximaEtapa = activePeriods.length > 1 ? "Confirmar as datas do calendário"
    : provaAtual ? "Provas em curso · acompanhar resultados"
    : upcoming ? upcoming.label + " · " + displayDate(upcoming.date)
    : pautaFinalPublicada ? "Pauta publicada · consultar resultado"
    : exames === "notas_pendentes" ? "Confirmar notas dos exames"
    : ativo?.numero === 3 ? "Acompanhar publicação da pauta"
    : anterior ? "Verificar pauta e resultado"
    : "Consultar calendário da turma";

  return {
    fase, faseLabel: labels[fase], proximaEtapa,
    provas: estadoProvas, proximaProvaEm: provaAtual?.data_inicio ?? provaFutura?.data_inicio ?? null,
    pautaFinalPublicada, publicacaoPautaPrevistaEm, exames, notasExameRegistadas,
    pedidosReapreciacao: input.pedidosReapreciacao ?? null,
  };
}
