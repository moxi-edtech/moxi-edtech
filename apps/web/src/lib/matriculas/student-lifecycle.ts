/**
 * KLASSE — projeção SSOT do ciclo de vida por matrícula (somente leitura).
 *
 * Uma matrícula descreve o vínculo operacional, nunca a aprovação do aluno.
 * O resultado académico só se torna oficial com histórico anual fechado.
 * Não corrigir estados persistidos a partir desta projeção.
 */
export type MatriculaOperacional = "pendente" | "ativa" | "encerrada" | "cancelada" | "revisao";
export type ResultadoAcademico = "pendente" | "aprovado" | "reprovado" | "concluido";
export type LifecycleIssueCode =
  | "STATUS_ATIVIDADE_DIVERGENTE"
  | "STATUS_LEGADO_DESCONHECIDO"
  | "ATIVAS_DUPLICADAS_NO_ANO"
  | "ATIVA_SEM_TURMA"
  | "ORIGEM_INEXISTENTE"
  | "ORIGEM_INCOMPATIVEL"
  | "ORIGEM_PENDENTE_COM_DESTINO_ATIVO"
  | "HISTORICO_SEM_VINCULO"
  | "HISTORICO_EM_CONSTRUCAO"
  | "RESULTADO_AINDA_NAO_OFICIAL";

export type MatriculaLifecycleInput = {
  id: string;
  escola_id: string;
  aluno_id: string;
  ano_letivo: number | null;
  status: string | null;
  ativo: boolean | null;
  turma_id: string | null;
  origem_transicao_matricula_id: string | null;
  data_fecho?: string | null;
  motivo_fecho?: string | null;
};

export type HistoricoLifecycleInput = {
  id: string;
  matricula_id: string | null;
  escola_id: string;
  aluno_id: string;
  ano_letivo: number | null;
  resultado_final: string | null;
  snapshot_status: string | null;
};

export type LifecycleIssue = {
  codigo: LifecycleIssueCode;
  mensagem: string;
};

export type StudentLifecycleEntry = {
  matriculaId: string;
  anoLetivo: number | null;
  turmaId: string | null;
  origemId: string | null;
  estadoOperacional: MatriculaOperacional;
  statusPersistido: string | null;
  ativoPersistido: boolean | null;
  motivoFecho: string | null;
  academico: {
    resultadoRegistrado: ResultadoAcademico;
    resultadoOficial: Exclude<ResultadoAcademico, "pendente"> | null;
    snapshot: string | null;
    historicoId: string | null;
  };
  pendencias: LifecycleIssue[];
  proximaAcao: "rever_integridade" | "confirmar_matricula" | "acompanhar_ano" | "validar_resultado" | "consultar_historico" | "nenhuma";
};

export type StudentLifecycle = {
  matriculas: StudentLifecycleEntry[];
  matriculaCorrente: StudentLifecycleEntry | null;
  pendenciasGerais: LifecycleIssue[];
};

const ativos = new Set(["ativo", "ativa", "active"]);
const encerrados = new Set(["concluido", "concluida", "encerrado", "encerrada", "transferido", "transferida", "reprovado", "reprovado_por_faltas", "inativo", "trancado"]);
const cancelados = new Set(["cancelado", "cancelada", "anulado", "anulada", "desistente"]);

const statusTexto = (value: string | null | undefined) => String(value ?? "").trim().toLowerCase();

export function normalizarEstadoMatricula(status: string | null | undefined, ativo: boolean | null | undefined): MatriculaOperacional {
  const value = statusTexto(status);
  if (ativos.has(value)) return ativo === true ? "ativa" : "revisao";
  if (value === "pendente") return ativo === false ? "pendente" : "revisao";
  if (encerrados.has(value)) return ativo === false ? "encerrada" : "revisao";
  if (cancelados.has(value)) return ativo === false ? "cancelada" : "revisao";
  // O status legado 'reprovado' apenas encerra o vínculo; o resultado académico vem do histórico.
  return "revisao";
}

export function normalizarResultadoAcademico(value: string | null | undefined): ResultadoAcademico {
  switch (statusTexto(value)) {
    case "aprovado": return "aprovado";
    case "reprovado": return "reprovado";
    case "concluido": return "concluido";
    default: return "pendente";
  }
}

export function construirCicloVidaAluno(
  matriculas: readonly MatriculaLifecycleInput[],
  historicos: readonly HistoricoLifecycleInput[],
  oficiaisPorMatricula?: ReadonlyMap<string, string | null>,
): StudentLifecycle {
  const ids = new Map(matriculas.map((m) => [m.id, m]));
  const porMatricula = new Map<string, HistoricoLifecycleInput[]>();
  const pendenciasGerais: LifecycleIssue[] = [];
  for (const historico of historicos) {
    const vinculo = historico.matricula_id ? ids.get(historico.matricula_id) : null;
    if (!vinculo || vinculo.escola_id !== historico.escola_id || vinculo.aluno_id !== historico.aluno_id
      || vinculo.ano_letivo !== historico.ano_letivo) {
      pendenciasGerais.push({
        codigo: "HISTORICO_SEM_VINCULO",
        mensagem: "Histórico anual sem vínculo inequívoco com a matrícula deste aluno, escola e ano.",
      });
      continue;
    }
    porMatricula.set(vinculo.id, [...(porMatricula.get(vinculo.id) ?? []), historico]);
  }

  // Mesmo em futuras leituras em lote, uma matrícula de outra escola ou
  // aluno nunca conta como duplicação da sessão corrente.
  const chaveAno = (matricula: MatriculaLifecycleInput) =>
    `${matricula.escola_id}:${matricula.aluno_id}:${matricula.ano_letivo ?? "sem_ano"}`;
  const matriculasAtivasPorAno = new Map<string, number>();
  for (const matricula of matriculas) {
    if (matricula.ativo === true) {
      const chave = chaveAno(matricula);
      matriculasAtivasPorAno.set(chave, (matriculasAtivasPorAno.get(chave) ?? 0) + 1);
    }
  }

  const ativosPorOrigem = new Set(
    matriculas.filter((m) => m.ativo === true && ativos.has(statusTexto(m.status)))
      .map((m) => m.origem_transicao_matricula_id).filter((id): id is string => Boolean(id)),
  );

  const resultado = matriculas.map((matricula): StudentLifecycleEntry => {
    const estado = normalizarEstadoMatricula(matricula.status, matricula.ativo);
    const pendencias: LifecycleIssue[] = [];
    const raw = statusTexto(matricula.status);
    if (estado === "revisao") {
      const conhecido = ativos.has(raw) || encerrados.has(raw) || cancelados.has(raw) || raw === "pendente";
      pendencias.push({
        codigo: conhecido ? "STATUS_ATIVIDADE_DIVERGENTE" : "STATUS_LEGADO_DESCONHECIDO",
        mensagem: conhecido
          ? "Estado da matrícula e indicador de atividade estão incoerentes."
          : "Estado legado sem equivalência operacional inequívoca; é necessária revisão.",
      });
    }
    if (matricula.ativo === true && (matriculasAtivasPorAno.get(chaveAno(matricula)) ?? 0) > 1) {
      pendencias.push({ codigo: "ATIVAS_DUPLICADAS_NO_ANO", mensagem: "Há mais de uma matrícula ativa no mesmo ano." });
    }
    if (matricula.ativo === true && !matricula.turma_id) {
      pendencias.push({ codigo: "ATIVA_SEM_TURMA", mensagem: "Matrícula ativa sem turma." });
    }
    if (matricula.origem_transicao_matricula_id) {
      const origem = ids.get(matricula.origem_transicao_matricula_id);
      if (!origem) {
        pendencias.push({ codigo: "ORIGEM_INEXISTENTE", mensagem: "Vínculo de origem ausente no histórico deste aluno." });
      } else if (origem.escola_id !== matricula.escola_id || origem.aluno_id !== matricula.aluno_id
        || origem.ano_letivo == null || matricula.ano_letivo == null || origem.ano_letivo >= matricula.ano_letivo) {
        pendencias.push({ codigo: "ORIGEM_INCOMPATIVEL", mensagem: "Matrícula de origem incompatível com escola, aluno ou ano." });
      }
    }
    if (estado === "pendente" && ativosPorOrigem.has(matricula.id)) {
      pendencias.push({
        codigo: "ORIGEM_PENDENTE_COM_DESTINO_ATIVO",
        mensagem: "Já existe matrícula destino ativa, mas a origem ainda está pendente de conciliação académica.",
      });
    }

    const vinculados = porMatricula.get(matricula.id) ?? [];
    const historico = vinculados.length === 1 ? vinculados[0] : null;
    if (vinculados.length > 1) {
      pendencias.push({ codigo: "HISTORICO_SEM_VINCULO", mensagem: "Mais de um histórico anual ligado à mesma matrícula." });
    }
    const registrado = normalizarResultadoAcademico(historico?.resultado_final);
    const fechado = statusTexto(historico?.snapshot_status) === "fechado";
    // Quando a projeção SQL está presente, ela exige histórico FECHADO
    // e lock legal confirmado. Não publicar uma aprovação apenas pelo campo
    // snapshot_status, sem a autoridade do banco.
    const resultadoDb = oficiaisPorMatricula?.get(matricula.id);
    const resultadoOficialDb = normalizarResultadoAcademico(resultadoDb);
    const oficial = oficiaisPorMatricula
      ? resultadoOficialDb === "pendente" ? null : resultadoOficialDb
      : fechado && registrado !== "pendente" ? registrado : null;
    if (historico && !fechado) {
      pendencias.push({ codigo: "HISTORICO_EM_CONSTRUCAO", mensagem: "Histórico anual ainda não congelado pelo fechamento oficial." });
    }
    if (registrado !== "pendente" && (!fechado || (oficiaisPorMatricula && !oficial))) {
      pendencias.push({ codigo: "RESULTADO_AINDA_NAO_OFICIAL", mensagem: "Resultado registado sem confirmação integral do fechamento e bloqueio legal." });
    }

    const proximaAcao: StudentLifecycleEntry["proximaAcao"] =
      pendencias.some((p) => p.codigo !== "HISTORICO_EM_CONSTRUCAO" && p.codigo !== "RESULTADO_AINDA_NAO_OFICIAL")
        ? "rever_integridade"
        : estado === "pendente" ? "confirmar_matricula"
          : estado === "ativa" ? "acompanhar_ano"
            : estado === "encerrada" && !oficial ? "validar_resultado"
              : estado === "encerrada" && oficial ? "consultar_historico" : "nenhuma";
    return {
      matriculaId: matricula.id,
      anoLetivo: matricula.ano_letivo,
      turmaId: matricula.turma_id,
      origemId: matricula.origem_transicao_matricula_id,
      estadoOperacional: estado,
      statusPersistido: matricula.status,
      ativoPersistido: matricula.ativo,
      motivoFecho: matricula.motivo_fecho ?? null,
      academico: {
        resultadoRegistrado: registrado,
        resultadoOficial: oficial,
        snapshot: historico?.snapshot_status ?? null,
        historicoId: historico?.id ?? null,
      },
      pendencias,
      proximaAcao,
    };
  }).sort((a, b) => {
    const year = (b.anoLetivo ?? -1) - (a.anoLetivo ?? -1);
    if (year) return year;
    const peso = (row: StudentLifecycleEntry) => row.estadoOperacional === "ativa" ? 0 : row.estadoOperacional === "pendente" ? 1 : 2;
    return peso(a) - peso(b) || a.matriculaId.localeCompare(b.matriculaId);
  });

  return { matriculas: resultado, matriculaCorrente: resultado[0] ?? null, pendenciasGerais };
}
