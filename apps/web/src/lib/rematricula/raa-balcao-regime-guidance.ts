import type { RaaDecretoResult } from "../academico/raa-decreto-eligibility";

export type RaaBalcaoRegime = {
  nivel_ensino?: string | null;
  classe_num?: number | null;
  modulo_numero?: number | null;
  ano_numero?: number | null;
  eh_classe_exame?: boolean | null;
  escala?: "quantitativa_primario" | "quantitativa_secundario" | "qualitativa" | null;
};
export type RaaBalcaoAcademic = {
  reason?: string;
  decision?: string | null;
  eligible?: boolean;
  mode?: "regular" | "conditional" | "repeat" | null;
  disciplina_ids_pendentes?: string[];
  regime?: RaaBalcaoRegime | null;
  decreto?: Pick<RaaDecretoResult,
    "decision" | "motivo" | "baseLegal" | "elegivelRecurso" | "exameExtraordinario" |
    "efetivacaoMatriculaBloqueada" | "disciplinasNegativas" | "disciplinasPendentes"
  > | null;
  guidance?: { titulo?: string; mensagem?: string; proximo_passo?: string } | null;
};
export type RaaBalcaoRegimeGuidance = {
  regime: string;
  titulo: string;
  descricao: string;
  instrucao: string;
  baseLegal: string | null;
  estado: "pendente" | "bloqueado" | "condicional_autorizada" | "concluido" | "informativo";
  podeEfetivar: boolean;
  decision: RaaDecretoResult["decision"] | null;
  origem: "decreto" | "sem_apuramento";
};
type KnownRegime =
  | "classe_6" | "classe_7" | "classe_8" | "classe_9" | "classe_10" | "classe_11" | "classe_12"
  | "eja_modulo_1" | "eja_modulo_2" | "eja_modulo_3" | "eja_ano_1" | "eja_ano_2";

function knownRegime(regime?: RaaBalcaoRegime | null): KnownRegime | null {
  if (!regime) return null;
  if (regime.nivel_ensino === "eja") {
    if ([1, 2, 3].includes(regime.modulo_numero ?? -1)) return ("eja_modulo_" + regime.modulo_numero) as KnownRegime;
    if ([1, 2].includes(regime.ano_numero ?? -1)) return ("eja_ano_" + regime.ano_numero) as KnownRegime;
    return null;
  }
  if (regime.classe_num != null && regime.classe_num >= 6 && regime.classe_num <= 12 &&
      Number.isInteger(regime.classe_num)) return ("classe_" + regime.classe_num) as KnownRegime;
  return null;
}
const descriptors: Record<KnownRegime, { label: string; identity: string; next: string }> = {
  classe_6: {
    label: "6.ª classe · conclusão do ensino primário",
    identity: "Classe de conclusão do ensino primário; o recurso, quando previsto pelo RAA, é distinto da progressão regular.",
    next: "Rever o resultado da 6.ª classe e, se houver recurso elegível, acompanhar a sessão e o resultado oficial.",
  },
  classe_7: {
    label: "7.ª classe · I ciclo",
    identity: "O RAA pode permitir inscrição condicional com disciplinas por regularizar e exame extraordinário rastreado.",
    next: "Verificar as disciplinas pendentes e manter a obrigação de exame extraordinário quando aplicável.",
  },
  classe_8: {
    label: "8.ª classe · I ciclo",
    identity: "Na passagem para a 9.ª classe, a inscrição condicional pode depender da resolução prévia do exame.",
    next: "Concluir a regularização académica antes de efetivar a 9.ª classe, quando o motor RAA bloquear.",
  },
  classe_9: {
    label: "9.ª classe · conclusão do I ciclo",
    identity: "O recurso de final de ciclo não equivale a aprovação nem cria uma matrícula para o ciclo seguinte.",
    next: "Concluir o recurso elegível e publicar o resultado oficial; se concluiu o ciclo, emitir documentos.",
  },
  classe_10: {
    label: "10.ª classe · II ciclo",
    identity: "A regra condicional considera as disciplinas específicas e Língua Portuguesa, segundo a decisão oficial.",
    next: "Confirmar as disciplinas elegíveis e manter o exame extraordinário rastreado na progressão condicional.",
  },
  classe_11: {
    label: "11.ª classe · II ciclo",
    identity: "A passagem para a 12.ª classe pode ficar bloqueada até regularização das disciplinas em exame.",
    next: "Resolver o exame extraordinário e revalidar o RAA antes da efetivação da 12.ª classe.",
  },
  classe_12: {
    label: "12.ª classe · conclusão do II ciclo",
    identity: "O recurso de conclusão considera a combinação das disciplinas específicas e gerais; não cria progressão automática.",
    next: "Concluir o recurso elegível; com o ciclo concluído, disponibilizar documentos finais no Balcão.",
  },
  eja_modulo_1: {
    label: "EJA · módulo 1",
    identity: "O módulo pode usar classificação qualitativa (Suficiente/Não suficiente) e exige frequência anual adequada.",
    next: "Confirmar as classificações qualitativas oficiais e a frequência anual antes de decidir a transição.",
  },
  eja_modulo_2: {
    label: "EJA · módulo 2",
    identity: "A transição depende das classificações qualitativas oficiais e da regra própria de frequência anual.",
    next: "Rever áreas de conhecimento e a frequência anual do módulo.",
  },
  eja_modulo_3: {
    label: "EJA · módulo 3",
    identity: "O RAA distingue a conclusão qualitativa do módulo do enquadramento de recurso com resultados numéricos.",
    next: "Confirmar se a pauta oficial é qualitativa ou numérica antes de tratar conclusão ou recurso.",
  },
  eja_ano_1: {
    label: "EJA · 1.º ano",
    identity: "Pode existir inscrição condicional sujeita a exame extraordinário e bloqueio de efetivação.",
    next: "Concluir a regularização exigida pela decisão RAA antes da matrícula de destino.",
  },
  eja_ano_2: {
    label: "EJA · 2.º ano",
    identity: "O recurso do último ano não é conclusão automática. A documentação final depende da decisão oficial.",
    next: "Acompanhar eventual recurso e confirmar conclusão antes da emissão documental.",
  },
};

/** Presentation only; never calculates grades or overrides the server's eligibility. */
export function buildRaaBalcaoRegimeGuidance(academic?: RaaBalcaoAcademic | null): RaaBalcaoRegimeGuidance | null {
  if (!academic) return null;
  const regime = knownRegime(academic.regime);
  const desc = regime ? descriptors[regime] : null;
  const label = desc?.label ?? (
    academic.regime?.classe_num != null
      ? String(academic.regime.classe_num) + ".ª classe · regime não apurado"
      : "Regime académico por confirmar"
  );
  const decree = academic.decreto;
  if (!decree) {
    return {
      regime: label,
      titulo: "Regra académica por confirmar",
      descricao: [desc?.identity, "O enquadramento jurídico individual não foi apurado. Não presumir recurso, aprovação ou inscrição condicional."].filter(Boolean).join(" "),
      instrucao: academic.guidance?.proximo_passo ?? "Rever a pauta e os dados da matrícula de origem com a direção; verificar novamente o RAA.",
      baseLegal: null, estado: "pendente", podeEfetivar: false, decision: null, origem: "sem_apuramento",
    };
  }

  const decision = decree.decision;
  const bloqueado = decree.efetivacaoMatriculaBloqueada;
  const condicional = decision === "inscricao_condicional";
  const isEjaModule = regime?.startsWith("eja_modulo_") ?? false;
  const { titulo, descricao, instrucao, estado } = (() => {
    if (decision === "pendente_dados") return {
      titulo: "Pauta ou dados académicos incompletos",
      descricao: isEjaModule
        ? "O módulo EJA exige dados completos; não converter automaticamente classificação qualitativa em nota numérica."
        : "Faltam componentes ou notas na pauta oficial. Sem resultado consolidado, não existe progressão presumida.",
      instrucao: desc?.next ?? "Concluir os dados académicos no período autorizado e revalidar o RAA.",
      estado: "pendente" as const,
    };
    if (decision === "reprovado_por_faltas") return {
      titulo: "Frequência insuficiente",
      descricao: decree.motivo === "frequencia_eja"
        ? "O módulo EJA exige pelo menos dois terços de frequência anual. Confirmar o total oficial e as justificações."
        : "A retenção depende das faltas injustificadas por trimestre e da carga horária semanal. Rever justificações aprovadas.",
      instrucao: "Analisar justificações existentes e solicitar revisão oficial da frequência. Nenhuma falta é apagada por este painel.",
      estado: "bloqueado" as const,
    };
    if (decision === "reprovado_por_indisciplina") return {
      titulo: "Revisão disciplinar necessária",
      descricao: "O registo disciplinar exige decisão administrativa distinta da pauta.",
      instrucao: "Solicitar decisão da direção e revalidar o RAA. A secretaria não pode remover esta retenção.",
      estado: "bloqueado" as const,
    };
    if (condicional) return {
      titulo: bloqueado ? "Inscrição condicional ainda não efetivável" : "Inscrição condicional autorizada pelo RAA",
      descricao: bloqueado
        ? "A inscrição condicional foi reconhecida, mas a matrícula de destino depende da regularização e decisão oficiais."
        : "O RAA permite avançar com acompanhamento das disciplinas pendentes e do exame extraordinário, se aplicável.",
      instrucao: bloqueado ? (desc?.next ?? "Concluir o exame e revalidar.") :
        "Continuar a rematrícula no wizard oficial, mantendo rastreáveis as disciplinas pendentes.",
      estado: bloqueado ? "bloqueado" as const : "condicional_autorizada" as const,
    };
    if (decision === "recurso") return {
      titulo: decree.elegivelRecurso ? "Exame de recurso previsto no RAA" : "Resultado sujeito a análise académica",
      descricao: "O recurso exige sessão e resultado oficiais. Uma nota isolada não conclui o recurso nem autoriza matrícula.",
      instrucao: desc?.next ?? "Consultar a sessão de recurso e aguardar publicação do resultado.",
      estado: "bloqueado" as const,
    };
    if (decision === "concluiu") return {
      titulo: "Ciclo ou módulo concluído",
      descricao: "A conclusão foi reconhecida pelo motor RAA. Não criar automaticamente rematrícula na etapa seguinte.",
      instrucao: "Consultar ou emitir documentos finais no Balcão, conforme permissões.",
      estado: "concluido" as const,
    };
    if (decision === "reprovado") return {
      titulo: "Retenção por aproveitamento",
      descricao: "A combinação das disciplinas negativas não permite progressão neste enquadramento.",
      instrucao: "Rever apenas por reapreciação formal; repetir a mesma classe quando o wizard autorizar.",
      estado: "informativo" as const,
    };
    return {
      titulo: "Progressão académica reconhecida",
      descricao: "O resultado oficial permite encaminhamento segundo as demais validações do Balcão.",
      instrucao: "Prosseguir com a operação permitida pelo serviço de rematrícula.",
      estado: "informativo" as const,
    };
  })();
  return {
    regime: label, titulo,
    descricao: [desc?.identity, descricao].filter(Boolean).join(" "),
    instrucao, baseLegal: decree.baseLegal || null, estado,
    // Even a positive decree can never override a negative server eligibility.
    podeEfetivar: !bloqueado && (decision === "transitou" || condicional || decision === "aprovado") && academic.eligible === true,
    decision, origem: "decreto",
  };
}
