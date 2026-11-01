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
  exames: "sem_sessao" | "agendados" | "com_notas" | "notas_pendentes";
  notasExameRegistadas: number;
  pedidosReapreciacao: number | null;
};

type Periodo = { id?: string; tipo: string; numero: number; data_inicio: string; data_fim: string };
type Evento = { tipo: string; data_inicio: string; data_fim: string };
type Sessao = { id: string; estado: string; data_inicio: string; data_fim: string };
type Resultado = { exame_sessao_id: string; nota: number | null; estado: string };

const PROVAS = new Set(["PROVA_TRIMESTRAL", "EXAME_NACIONAL", "EXAME_ORAL", "EXAME_ESCRITO", "EXAME_EXTRAORDINARIO"]);

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
  const ativo = periodos.find((p) => p.data_inicio <= hoje && hoje <= p.data_fim);
  const seguinte = periodos.find((p) => p.data_inicio > hoje);
  const anterior = [...periodos].reverse().find((p) => p.data_fim < hoje);
  const fase = ativo
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
  const proximaEtapa = ativo?.numero === 1 ? "Próxima etapa: 2.º trimestre"
    : ativo?.numero === 2 ? "Próxima etapa: 3.º trimestre"
    : ativo?.numero === 3 ? "Próxima etapa: provas, pautas e decisão final"
    : seguinte ? "Próxima etapa: " + seguinte.numero + ".º trimestre"
    : anterior ? "Verificar provas, pauta e decisão académica"
    : "Consultar calendário académico da turma";

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

  return {
    fase, faseLabel: labels[fase], proximaEtapa,
    provas: estadoProvas, proximaProvaEm: provaAtual?.data_inicio ?? provaFutura?.data_inicio ?? null,
    pautaFinalPublicada, exames, notasExameRegistadas,
    pedidosReapreciacao: input.pedidosReapreciacao ?? null,
  };
}
