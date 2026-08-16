import type { RaaAcademicStatus } from "@/lib/academico/raa-eligibility"
import { resolveRaaProgression, type RaaProgressionResult } from "@/lib/academico/raa-progression"
import { resolveRegimeAcademico, type RegimeAcademico } from "@/lib/academico/regime-academico"
import { resolveRaaDecretoEligibility, type RaaDecretoRegime, type RaaDecretoResult } from "@/lib/academico/raa-decreto-eligibility"

const canonicalStatuses = new Set<RaaAcademicStatus>([
  "aprovado",
  "recurso",
  "reprovado",
  "reprovado_por_faltas",
  "reprovado_por_indisciplina",
  "pendente_dados",
  "pendente_formula",
])

export class RaaProgressionUnavailableError extends Error {
  readonly code: "RAA_PROGRESSION_POLICY_NOT_CONFIGURED" | "ACADEMIC_RESULT_INVALID"

  constructor(code: RaaProgressionUnavailableError["code"], message: string) {
    super(message)
    this.name = "RaaProgressionUnavailableError"
    this.code = code
  }
}

export type RaaProgressionServerResult = {
  progression: RaaProgressionResult
  regime: RegimeAcademico
  disciplinas: Array<{ disciplina_id: string; status: RaaAcademicStatus }>
  frequencia: { percentual_presenca: number | null; frequencia_min_percent: number }
  decreto: RaaDecretoResult | null
  orientacao: RaaProgressionGuidance
}

export type RaaProgressionGuidance = {
  estado: "pendente" | "bloqueado" | "concluido" | "pronto"
  titulo: string
  mensagem: string
  proximo_passo: string
  acoes: Array<{ id: string; label: string; href: string; prioridade: "principal" | "secundaria" }>
}

function buildGuidance(
  progression: RaaProgressionResult,
  decreto: RaaDecretoResult | null,
  matriculaId: string,
): RaaProgressionGuidance {
  const query = `?matricula_id=${encodeURIComponent(matriculaId)}`
  if (progression.decision === "pendente") {
    const formulaPendente = decreto?.baseLegal?.toLowerCase().includes("mfd")
    return {
      estado: "pendente",
      titulo: formulaPendente ? "Fórmula do resultado pendente" : "Dados académicos pendentes",
      mensagem: formulaPendente
        ? "A decisão está bloqueada porque a fórmula ou os componentes do resultado ainda não estão completos."
        : "A decisão está bloqueada porque faltam notas finais ou dados de frequência para esta matrícula.",
      proximo_passo: formulaPendente
        ? "Concluir a fórmula e os componentes da pauta; depois reexecutar a análise."
        : "Concluir notas e verificar a frequência; depois reexecutar a análise.",
      acoes: formulaPendente
        ? [{ id: "concluir_pauta", label: "Abrir fechamento académico", href: `/secretaria/fechamento-academico${query}`, prioridade: "principal" }]
        : [
            { id: "concluir_notas", label: "Abrir notas", href: `/secretaria/notas${query}`, prioridade: "principal" },
            { id: "verificar_frequencia", label: "Verificar frequência", href: `/professor/frequencias${query}`, prioridade: "secundaria" },
          ],
    }
  }
  if (progression.decision === "recurso") {
    return {
      estado: "bloqueado",
      titulo: "Recurso disponível",
      mensagem: "A matrícula não deve avançar sem tratar as disciplinas elegíveis para recurso.",
      proximo_passo: "Rever as disciplinas negativas e abrir ou acompanhar o recurso correspondente.",
      acoes: [{ id: "abrir_recursos", label: "Abrir recursos e reapreciações", href: `/secretaria/raa/reapreciacoes${query}`, prioridade: "principal" }],
    }
  }
  if (progression.decision.startsWith("retido")) {
    return {
      estado: "bloqueado",
      titulo: "Matrícula bloqueada",
      mensagem: progression.motivo === "faltas" ? "A retenção decorre de faltas segundo a regra legal." : "A retenção decorre da decisão académica vigente.",
      proximo_passo: "Rever o detalhe da decisão e corrigir apenas dados comprovadamente incorretos, com rastreabilidade.",
      acoes: [{ id: "rever_decisao", label: "Rever decisão académica", href: `/secretaria/operacoes-academicas/fechamento-academico${query}`, prioridade: "principal" }],
    }
  }
  if (progression.decision === "transitou" || progression.decision === "concluiu") {
    return {
      estado: "concluido",
      titulo: progression.decision === "concluiu" ? "Ciclo concluído" : "Transição autorizada",
      mensagem: "A decisão jurídica está completa e pode ser usada pelo fluxo de matrícula.",
      proximo_passo: progression.decision === "concluiu" ? "Emitir ou consultar os documentos finais." : "Continuar para a confirmação da matrícula seguinte.",
      acoes: [{ id: "continuar_matricula", label: "Continuar matrícula", href: `/secretaria/rematricula${query}`, prioridade: "principal" }],
    }
  }
  return {
    estado: "pronto",
    titulo: "Análise disponível",
    mensagem: "A decisão académica está disponível para o próximo passo operacional.",
    proximo_passo: "Rever o resultado e continuar no fluxo de matrícula.",
    acoes: [{ id: "continuar_matricula", label: "Continuar matrícula", href: `/secretaria/rematricula${query}`, prioridade: "principal" }],
  }
}

function decretoRegime(regime: RegimeAcademico): RaaDecretoRegime | null {
  if (regime.nivel_ensino === "eja") {
    if (regime.modulo_numero === 1) return "eja_modulo_1"
    if (regime.modulo_numero === 2) return "eja_modulo_2"
    if (regime.modulo_numero === 3) return "eja_modulo_3"
    if (regime.ano_numero === 1) return "eja_ano_1"
    if (regime.ano_numero === 2) return "eja_ano_2"
  }
  if (regime.classe_num != null && regime.classe_num >= 6 && regime.classe_num <= 12) {
    return `classe_${regime.classe_num}` as RaaDecretoRegime
  }
  return null
}

export async function resolveDecretoDecision(
  supabase: any,
  escolaId: string,
  matriculaId: string,
  turmaId: string,
  regime: RegimeAcademico,
  disciplinaIds: string[],
) {
  const codigoRegime = decretoRegime(regime)
  if (!codigoRegime || disciplinaIds.length === 0) return null

  const [{ data: pauta, error: pautaError }, { data: links, error: linksError }, { data: catalogo, error: catalogoError }] = await Promise.all([
    supabase
      .from("vw_boletim_por_matricula")
      .select("disciplina_id, disciplina_nome, nota_final")
      .eq("escola_id", escolaId)
      .eq("matricula_id", matriculaId)
      .in("disciplina_id", disciplinaIds),
    supabase
      .from("turma_disciplinas")
      .select("id, avaliacao_disciplina_id, carga_horaria_semanal, classificacao, curso_matriz_id")
      .eq("escola_id", escolaId)
      .eq("turma_id", turmaId)
      .in("avaliacao_disciplina_id", disciplinaIds),
    supabase
      .from("disciplinas_catalogo")
      .select("id, nome, area, carga_horaria_semana")
      .eq("escola_id", escolaId)
      .in("id", disciplinaIds),
  ])

  if (pautaError || linksError || catalogoError) return null

  const linkRows = (links ?? []) as Array<{ id?: string; avaliacao_disciplina_id?: string; carga_horaria_semanal?: number | null; classificacao?: string | null; curso_matriz_id?: string | null }>
  const turmaDisciplinaIds = linkRows.map((row) => row.id).filter((id): id is string => Boolean(id))
  const { data: aulas } = turmaDisciplinaIds.length > 0
    ? await supabase.from("aulas").select("id, turma_disciplina_id").eq("escola_id", escolaId).in("turma_disciplina_id", turmaDisciplinaIds)
    : { data: [] }
  const aulaRows = (aulas ?? []) as Array<{ id: string; turma_disciplina_id: string }>
  const aulaIds = aulaRows.map((row) => row.id)
  const { data: frequencias } = aulaIds.length > 0
    ? await supabase.from("frequencias").select("aula_id, periodo_letivo_id, status").eq("escola_id", escolaId).eq("matricula_id", matriculaId).in("aula_id", aulaIds)
    : { data: [] }
  const frequenciaRows = (frequencias ?? []) as Array<{ aula_id: string; periodo_letivo_id: string | null; status: string }>
  const periodoIds = Array.from(new Set(frequenciaRows.map((row) => row.periodo_letivo_id).filter((id): id is string => Boolean(id))))
  const { data: periodos } = periodoIds.length > 0
    ? await supabase.from("periodos_letivos").select("id, numero, tipo").eq("escola_id", escolaId).in("id", periodoIds)
    : { data: [] }
  const periodoNumero = new Map<string, number>((periodos ?? []).map((row: any) => [String(row.id), Number(row.numero)]))
  const aulaDisciplina = new Map<string, string>(aulaRows.map((row) => [row.id, row.turma_disciplina_id]))
  const faltasPorTurmaDisciplina = new Map<string, number[]>()
  for (const row of frequenciaRows) {
    if (!['falta', 'ausente'].includes(String(row.status).toLowerCase())) continue
    const turmaDisciplinaId = aulaDisciplina.get(row.aula_id)
    const trimestre = row.periodo_letivo_id ? periodoNumero.get(row.periodo_letivo_id) : null
    if (!turmaDisciplinaId || !trimestre || trimestre < 1 || trimestre > 3) continue
    const faltas = faltasPorTurmaDisciplina.get(turmaDisciplinaId) ?? [0, 0, 0]
    faltas[trimestre - 1] += 1
    faltasPorTurmaDisciplina.set(turmaDisciplinaId, faltas)
  }

  const pautaById = new Map<string, any>((pauta ?? []).map((row: any) => [String(row.disciplina_id), row]))
  const linkById = new Map<string, any>(linkRows.map((row) => [String(row.avaliacao_disciplina_id), row]))
  const catalogoById = new Map<string, any>((catalogo ?? []).map((row: any) => [String(row.id), row]))
  const disciplinas = disciplinaIds.map((id) => {
    const row = pautaById.get(id)
    const link = linkById.get(id)
    const catalog = catalogoById.get(id)
    const nome = String(row?.disciplina_nome ?? catalog?.nome ?? "")
    const nomeNormalizado = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    return {
      id,
      nome,
      notaFinal: row?.nota_final == null ? null : Number(row.nota_final),
      area: catalog?.area ?? null,
      especifica: String(link?.classificacao ?? "") === "especifica" || String(catalog?.area ?? "").toLowerCase().includes("especific"),
      linguaPortuguesa: nomeNormalizado.includes("lingua portuguesa") || nomeNormalizado === "portugues",
      matematica: nomeNormalizado.includes("matematica"),
      temposSemanais: Number(link?.carga_horaria_semanal ?? catalog?.carga_horaria_semana ?? 0) || null,
      faltasInjustificadasPorTrimestre: link?.id ? (faltasPorTurmaDisciplina.get(String(link.id)) ?? [0, 0, 0]) : [0, 0, 0],
    }
  })

  const legal = resolveRaaDecretoEligibility({
    regime: codigoRegime,
    disciplinas,
    dadosCompletos: disciplinas.every((d) => d.notaFinal != null),
  })
  return legal
}

export async function resolveRaaProgressionForMatricula(
  supabase: any,
  escolaId: string,
  matricula: { id: string; aluno_id?: string | null; turma_id: string },
): Promise<RaaProgressionServerResult> {
  const { data: databaseResult, error: databaseError } = await supabase.rpc(
    "resolve_raa_progression_for_matricula",
    { p_escola_id: escolaId, p_matricula_id: matricula.id },
  )

  if (!databaseError && databaseResult) {
    const decision = databaseResult.decision as RaaProgressionResult["decision"]
    const regime = databaseResult.regime as RegimeAcademico
    const databaseDisciplinas = (databaseResult.disciplinas ?? []) as Array<{ disciplina_id: string; status: RaaAcademicStatus }>
    const legal = await resolveDecretoDecision(
      supabase,
      escolaId,
      matricula.id,
      matricula.turma_id,
      regime,
      databaseDisciplinas.map((item) => item.disciplina_id),
    )
    const legalProgression = legal
      ? resolveRaaProgression({
          disciplinas: databaseDisciplinas.map(({ disciplina_id, status }) => ({ disciplinaId: disciplina_id, status })),
          etapaAtual: {
            nivelEnsino: regime.nivel_ensino,
            classeNum: regime.classe_num,
            anoNumero: regime.ano_numero,
            moduloNumero: regime.modulo_numero,
            ehClasseExame: regime.eh_classe_exame,
          },
          decretoDecision: legal.decision,
          decretoMatriculaBloqueada: legal.efetivacaoMatriculaBloqueada,
        })
      : null
    const finalProgression = {
      decision: legalProgression?.decision ?? decision,
      destino: legalProgression?.destino ?? databaseResult.destino,
      motivo: legalProgression?.motivo ?? databaseResult.motivo,
      disciplinaIdsPendentes: legalProgression?.disciplinaIdsPendentes ?? (databaseResult.disciplina_ids_pendentes ?? []) as string[],
      etapaDestino: legalProgression?.etapaDestino ?? databaseResult.etapa_destino ?? null,
    }
    return {
      regime,
      disciplinas: databaseDisciplinas,
      frequencia: {
        percentual_presenca: databaseResult.frequencia?.percentual_presenca ?? null,
        frequencia_min_percent: Number(databaseResult.frequencia?.frequencia_min_percent ?? 75),
      },
      progression: finalProgression,
      decreto: legal,
      orientacao: buildGuidance(finalProgression, legal, matricula.id),
    }
  }

  if (databaseError && !/resolve_raa_progression_for_matricula|function .* does not exist/i.test(databaseError.message ?? "")) {
    if (/RAA_PROGRESSION_POLICY_NOT_CONFIGURED/i.test(databaseError.message ?? "")) {
      throw new RaaProgressionUnavailableError(
        "RAA_PROGRESSION_POLICY_NOT_CONFIGURED",
        "A política de progressão da escola ainda não está configurada.",
      )
    }
    if (/ACADEMIC_RESULT_INVALID/i.test(databaseError.message ?? "")) {
      throw new RaaProgressionUnavailableError(
        "ACADEMIC_RESULT_INVALID",
        "O resolvedor não devolveu um estado académico válido.",
      )
    }
    throw databaseError
  }

  const [{ data: links, error: linksError }, { data: config, error: configError }] = await Promise.all([
    supabase
      .from("turma_disciplinas")
      .select("avaliacao_disciplina_id")
      .eq("escola_id", escolaId)
      .eq("turma_id", matricula.turma_id)
      .not("avaliacao_disciplina_id", "is", null)
      .limit(100),
    supabase
      .from("configuracoes_pedagogicas")
      .select("permitir_inscricao_condicional, permitir_progressao_com_recurso")
      .eq("escola_id", escolaId)
      .maybeSingle(),
  ])

  if (linksError) throw new Error("Não foi possível carregar as disciplinas da turma.")
  if (configError || !config) {
    throw new RaaProgressionUnavailableError(
      "RAA_PROGRESSION_POLICY_NOT_CONFIGURED",
      "A política de progressão da escola ainda não está configurada.",
    )
  }

  const disciplinaIds = Array.from(new Set((links ?? []).map((row: any) => row.avaliacao_disciplina_id).filter(Boolean))) as string[]
  const canonicalResults = await Promise.all(
    disciplinaIds.map(async (disciplinaId) => {
      const { data, error } = await supabase.rpc("resolve_estado_resultado", {
        p_matricula_id: matricula.id,
        p_disciplina_id: disciplinaId,
      })
      if (error) throw error
      return { disciplina_id: disciplinaId, status: data?.status as RaaAcademicStatus | undefined }
    }),
  )

  if (canonicalResults.some(({ status }) => !status || !canonicalStatuses.has(status))) {
    throw new RaaProgressionUnavailableError(
      "ACADEMIC_RESULT_INVALID",
      "O resolvedor não devolveu um estado académico válido.",
    )
  }

  const regime = await resolveRegimeAcademico(supabase, matricula.turma_id)
  const { data: frequencias, error: frequenciasError } = await supabase
    .from("frequencia_status_periodo")
    .select("faltas, aulas_previstas, frequencia_min_percent")
    .eq("escola_id", escolaId)
    .eq("matricula_id", matricula.id)
    .limit(100)
  if (frequenciasError) throw new Error("Não foi possível carregar a frequência.")

  const frequenciaRows = (frequencias ?? []) as Array<{ faltas: number | null; aulas_previstas: number | null; frequencia_min_percent: number | null }>
  const aulas = frequenciaRows.reduce((sum, row) => sum + Math.max(0, Number(row.aulas_previstas ?? 0)), 0)
  const faltas = frequenciaRows.reduce((sum, row) => sum + Math.max(0, Number(row.faltas ?? 0)), 0)
  const percentualPresenca = aulas > 0 ? Number((((aulas - faltas) / aulas) * 100).toFixed(2)) : null
  const frequenciaMinima = Number(frequenciaRows.find((row) => row.frequencia_min_percent != null)?.frequencia_min_percent ?? 75)

  const statuses = canonicalResults as Array<{ disciplina_id: string; status: RaaAcademicStatus }>
  const progression = resolveRaaProgression({
    disciplinas: statuses.map(({ disciplina_id, status }) => ({ disciplinaId: disciplina_id, status })),
    etapaAtual: {
      nivelEnsino: regime.nivel_ensino,
      classeNum: regime.classe_num,
      anoNumero: regime.ano_numero,
      moduloNumero: regime.modulo_numero,
      ehClasseExame: regime.eh_classe_exame,
    },
    dadosCompletos: statuses.length > 0 && statuses.every(({ status }) => status !== "pendente_dados" && status !== "pendente_formula"),
    permitirInscricaoCondicional: config.permitir_inscricao_condicional === true,
    permitirProgressaoComRecurso: config.permitir_progressao_com_recurso !== false,
    retidoPorFaltas: percentualPresenca != null && percentualPresenca < frequenciaMinima,
  })
  return {
    regime,
    disciplinas: statuses,
    frequencia: { percentual_presenca: percentualPresenca, frequencia_min_percent: frequenciaMinima },
    decreto: null,
    progression,
    orientacao: buildGuidance(progression, null, matricula.id),
  }
}
