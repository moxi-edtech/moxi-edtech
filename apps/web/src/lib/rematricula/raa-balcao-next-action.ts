import type { RaaBalcaoTimeline } from "./raa-balcao-timeline";

/**
 * Presentation-only guidance. The calendar never changes RAA eligibility,
 * creates an enrollment or authorizes a protected operation.
 */
export function nextAcademicActionForBalcao(
  status: string | null,
  timeline: RaaBalcaoTimeline | null,
): { title: string | null; message: string | null } {
  if (status !== "ACADEMIC_PENDING" || !timeline) {
    return { title: null, message: null };
  }

  if (timeline.fase === "desconhecida") {
    return {
      title: "Calendário por confirmar",
      message: "Verifique as datas da turma antes de acompanhar o resultado.",
    };
  }

  if (timeline.pautaFinalPublicada) {
    return {
      title: "Resultado por confirmar",
      message: "Pauta publicada. Verifique o resultado académico para continuar.",
    };
  }

  if (timeline.provas === "em_curso") {
    return {
      title: "Provas em curso",
      message: "Acompanhe as provas e aguarde a publicação das notas.",
    };
  }

  if (timeline.fase === "apos_fim" && timeline.exames === "notas_pendentes") {
    return {
      title: "Notas por confirmar",
      message: "Consulte as notas dos exames e verifique o resultado.",
    };
  }

  if (timeline.fase === "apos_fim") {
    return {
      title: "Resultado por confirmar",
      message: "Aguardar publicação da pauta final.",
    };
  }

  const next = timeline.proximaEtapa;
  if (next.startsWith("Consultar calendário")) {
    return {
      title: "Ano em curso",
      message: "Acompanhe o trimestre. A decisão final ainda não está disponível.",
    };
  }

  return {
    title: "Ano em curso",
    message: next + " · aguarde a decisão final.",
  };
}
