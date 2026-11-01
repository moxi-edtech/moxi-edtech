import type { RaaBalcaoTimeline } from "./raa-balcao-timeline";
import type { RaaBalcaoAcademic } from "./raa-balcao-regime-guidance";

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

/**
 * Headline for unresolved RAA subjects. This is informational: grade writes,
 * reopenings and rematriculation remain subject to their official endpoints.
 * Trimesters in progress are not treated as annual failures.
 */
export function pendingSubjectsActionForBalcao(
  status: string | null,
  academic: RaaBalcaoAcademic | null,
  canLancarNota: boolean,
  timeline: RaaBalcaoTimeline | null,
): { title: string; message: string } | null {
  if (!["ACADEMIC_PENDING", "ACADEMIC_REVIEW_REQUIRED", "ACADEMIC_CONDITIONAL_BLOCKED"].includes(status ?? "") ||
      academic?.eligible === true) return null;
  const count = academic?.disciplina_ids_pendentes?.length ?? 0;
  if (!count) return null;
  const description = count === 1 ? "1 disciplina" : `${count} disciplinas`;
  const source = academic?.source;
  if (!source?.turma_id || !source.ano_letivo_id) return {
    title: "Dados por verificar",
    message: `${description} por verificar · Verifique a matrícula de origem.`,
  };
  const sourceActive = ["ativo", "ativa", "active"].includes(source.status?.toLowerCase() ?? "");
  if (!sourceActive) return {
    title: "Regularização bloqueada",
    message: `${description} por regularizar · Solicite a reabertura à direção.`,
  };
  if (timeline?.fase === "primeiro" || timeline?.fase === "segundo") return {
    title: "Em acompanhamento",
    message: `${description} em acompanhamento · A decisão anual ainda não está disponível.`,
  };
  if (status === "ACADEMIC_REVIEW_REQUIRED" || status === "ACADEMIC_CONDITIONAL_BLOCKED") return {
    title: "Recurso por resolver",
    message: `${description} em revisão · Consulte os exames e recursos.`,
  };
  if (academic?.regime?.escala === "qualitativa") return {
    title: "Pauta por completar",
    message: `${description} por regularizar · Verifique as classificações qualitativas.`,
  };
  return canLancarNota
    ? { title: "Notas por regularizar", message: `${description} por regularizar · Reveja as avaliações pendentes.` }
    : { title: "Revisão necessária", message: `${description} por regularizar · Solicite revisão a um perfil autorizado.` };
}
