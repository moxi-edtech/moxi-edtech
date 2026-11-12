import type { SituacaoMatriculaContextual } from "@/lib/matriculas/lifecycle-status-contract";

export type SituacaoBalcaoRow = {
  matricula_id: string;
  escola_id: string;
  aluno_id: string;
  ano_letivo: number;
  ano_letivo_id: string | null;
  turma_id: string | null;
  status_persistido: string | null;
  situacao_contextual: SituacaoMatriculaContextual;
  situacao_resultado: "homologado" | "registado_nao_homologado" | "sem_resultado_oficial";
  acao_contextual: string;
  resultado_oficial: string | null;
};
export type SituacaoBalcaoPayload = {
  ok: true;
  aluno_id: string;
  ano: { id: string; ano: number; label: string; ativo: boolean; arquivado_com_pendencias: boolean };
  current: SituacaoBalcaoRow | null;
  previous: SituacaoBalcaoRow | null;
  can_write_current_grades: boolean;
  editable_historical_matricula_id: string | null;
  historical_evaluation_scale: string | null;
};
export type ContextualAction = "enrollment" | "grade" | "historical" | "reenrollment" | "profile" | null;

export function resolveStudentYearSituation(data: SituacaoBalcaoPayload): {
  title: string; description: string; action: ContextualAction; actionLabel: string | null;
} {
  const { current, previous, ano } = data;
  if (!current) {
    const originIsLastYear = previous?.ano_letivo === ano.ano - 1;
    const originPending = originIsLastYear &&
      ["regularizacao_historica", "ano_encerrado"].includes(previous?.situacao_contextual ?? "") &&
      previous?.situacao_resultado !== "homologado";
    if (originPending && previous) return {
      title: "Histórico de " + previous.ano_letivo + " por regularizar",
      description: "Há uma matrícula anterior sem resultado homologado. Resolva a decisão escolar documentada antes de prosseguir com " + ano.ano + ".",
      action: "historical", actionLabel: "Resolver histórico de " + previous.ano_letivo,
    };
    if (previous && originIsLastYear && previous.situacao_resultado === "homologado") {
      const finishedCycle = previous.resultado_oficial?.toLowerCase() === "concluido";
      return {
        title: finishedCycle ? "Ciclo de " + previous.ano_letivo + " concluído"
          : "Resultado de " + previous.ano_letivo + " homologado",
        description: finishedCycle
          ? "O ciclo foi concluído. Consulte a documentação final, sem criar uma matrícula de progressão."
          : "O resultado oficial já existe. Verifique a elegibilidade e a situação de pagamento antes de efetivar a matrícula de " + ano.ano + ".",
        action: finishedCycle ? "profile" : ano.ativo ? "reenrollment" : "profile",
        actionLabel: finishedCycle ? "Consultar histórico" : ano.ativo ? "Continuar matrícula de " + ano.ano : "Consultar histórico",
      };
    }
    return {
      title: "Sem matrícula em " + ano.label,
      description: previous
        ? "Existe matrícula anterior. Verifique a situação académica antes de iniciar uma nova matrícula."
        : "Não existe vínculo neste ano. Confira a admissão ou documentação escolar.",
      action: ano.ativo ? (previous ? "reenrollment" : "enrollment") : "profile",
      actionLabel: ano.ativo
        ? (previous ? "Ver rematrícula e pendências" : "Abrir matrícula")
        : "Consultar ficha",
    };
  }
  const status = current.situacao_contextual;
  if (status === "regularizacao_historica") return {
    title: "Histórico por regularizar",
    description: "A matrícula de origem existe. O resultado académico continua pendente e precisa de evidência real.",
    action: "historical", actionLabel: "Resolver histórico",
  };
  if (status === "matriculado") {
    if (!ano.ativo) return {
      title: "Matrícula ativa em ano arquivado",
      description: "Verifique o vínculo. O arquivo do ano não autoriza lançamentos normais de notas.",
      action: "profile", actionLabel: "Consultar ficha",
    };
    return {
      title: "Matriculado em " + ano.label,
      description: "Matrícula confirmada. Pode consultar e resolver as atividades do ano selecionado.",
      action: data.can_write_current_grades ? "grade" : "profile",
      actionLabel: data.can_write_current_grades ? "Lançar notas" : "Consultar ficha",
    };
  }
  if (status === "aguarda_confirmacao" || status === "rascunho") return {
    title: status === "rascunho" ? "Matrícula em preparação" : "Matrícula por confirmar",
    description: "O aluno já possui um registo neste ano. Continue a confirmação na ficha, sem criar outra matrícula.",
    action: "profile",
    actionLabel: ano.ativo ? "Rever matrícula existente" : "Consultar ficha",
  };
  if (status === "ano_encerrado") return {
    title: "Ano escolar encerrado",
    description: current.situacao_resultado === "homologado"
      ? "O resultado oficial está disponível no histórico."
      : "O vínculo está encerrado, mas o resultado académico ainda não foi homologado.",
    action: current.situacao_resultado === "homologado" ? "profile" : "historical",
    actionLabel: current.situacao_resultado === "homologado" ? "Consultar histórico" : "Regularizar resultado",
  };
  if (status === "revisao_integridade") return {
    title: "Vínculo por rever",
    description: "Há uma divergência na matrícula. Consulte a ficha e reconcilie os dados existentes.",
    action: "profile", actionLabel: "Rever matrícula",
  };
  const labels: Record<string, string> = {
    transferido: "Aluno transferido",
    trancado: "Matrícula trancada",
    desistente: "Desistência registada",
    anulado: "Matrícula anulada",
  };
  return {
    title: labels[status] ?? "Movimento escolar",
    description: "Consulte o movimento e a documentação registada. Não é permitido presumir progressão.",
    action: "profile", actionLabel: "Consultar ficha",
  };
}

export function hasHistoricalPending(data: SituacaoBalcaoPayload): boolean {
  return Boolean(data.previous &&
    ["regularizacao_historica", "ano_encerrado"].includes(data.previous.situacao_contextual) &&
    data.previous.situacao_resultado !== "homologado");
}
