import { supabaseServerTyped } from "@/lib/supabaseServer";
import { disabledIntelligenceReason } from "../intelligence-activation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { resolveAcademicYearScope, type AcademicYearScope } from "@/lib/academic-year/context";
import { hasAssistantPermission } from "../../permission-registry";
import { createDataCopilotResponse } from "../answer-composer";
import { instantiateAssistantActionV2 } from "../../actions-v2";
import {
  classifySchoolQuestion, extractSchoolFilters, isStatisticalSchoolQuestion, safeDisplayText,
  canReadWholeSchoolIntelligence, validIntelligenceContinuation,
  SchoolIntelligenceConversationSchema, summarizeTeacherGrades, verifyTeacherAssignmentCoverage,
  type IntelligenceIntent, type ProfessorGradeRow, type SchoolIntelligenceFilters,
} from "../school-intelligence-contract";
import type { DataCopilotResponse, DataCopilotTool, ToolRunParams } from "../types";

const MAX_CLASS_ROWS = 350;
const MAX_GRADE_ROWS = 450;
const MAX_PER_USER_MINUTE = 12;
const MAX_PER_SCHOOL_MINUTE = 90;
const PAGE_SIZE = 8;
const AOA = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" });

function failure(why: string, source: string): DataCopilotResponse {
  return createDataCopilotResponse({ insight: {
    diagnosis: `**Não posso determinar este resultado com segurança.** ${why}`,
    impact: "Nenhum total foi estimado e nenhum registo escolar foi alterado.",
    recommendation: "Verifique a fonte indicada no módulo oficial ou complete o dado em falta.",
    evidence: [{ label: "Fonte necessária", value: source }], actions: [],
    provenance: { source, consultedAt: new Date().toISOString(), scope: "Acesso limitado à escola e ao perfil autorizado", freshness: "unknown", limitation: why },
  } });
}

const intentPermissions: Record<IntelligenceIntent, string> = {
  teacher_grade_deadlines: "assistant.academico", teacher_pending_details: "assistant.academico",
  students_without_subject_grades: "assistant.academico", monthly_absences: "assistant.academico",
  pending_enrollments: "assistant.secretaria", available_class_seats: "assistant.secretaria",
  monthly_finance: "assistant.finance", aged_tuitions: "assistant.finance",
  missing_documents: "assistant.secretaria", official_failure_risk: "assistant.academico",
};

export async function runSchoolIntelligence(params: ToolRunParams): Promise<DataCopilotResponse | null> {
  const conversation = validIntelligenceContinuation(params.conversation, params.userId, params.schoolId);
  const intent = classifySchoolQuestion(params.query, conversation);
  if (!intent) return isStatisticalSchoolQuestion(params.query)
    ? failure("Esta pergunta não corresponde a uma consulta homologada do catálogo; não vou inventar a resposta.", "Catálogo KLASSE IA") : null;
  const disabledReason = disabledIntelligenceReason(intent);
  if (disabledReason) return failure(disabledReason, `Ativação independente: ${intent}`);
  if (!hasAssistantPermission(params.role, intentPermissions[intent])) {
    return failure("O seu papel não está autorizado a consultar este domínio.", "Permissões KLASSE / escola_users");
  }
  // The checked-in model has no polo membership or polo_id on the underlying views.
  // Refuse all campus-restricted roles until server-side source scoping can be demonstrated.
  if (!canReadWholeSchoolIntelligence(params.role, params.query)) {
    return failure("Não existe filtro de polo comprovado na fonte canónica para este papel. Esta consulta exige vinculação segura entre utilizador, polo e registos, sem alargar o acesso.",
      "escola_users / modelo de polos");
  }
  const filters = extractSchoolFilters(params.query, conversation?.filters);
  if (params.context?.academicYearId) filters.academicYearId = params.context.academicYearId;
  const checkedFilters = SchoolIntelligenceConversationSchema.shape.filters.parse(filters);
  if (intent === "monthly_absences" && checkedFilters.threshold === undefined) return failure("Indique N: por exemplo, 'mais de 5 faltas este mês'.", "vw_frequencia_resumo_aluno");
  if (intent === "aged_tuitions" && checkedFilters.threshold === undefined) return failure("Indique quantos dias vencidos pretende consultar.", "vw_financeiro_inadimplencia_top_ano");
  if (intent === "students_without_subject_grades" && !checkedFilters.subject) return failure("Indique a disciplina pretendida.", "vw_professor_pendencias");

  // No base-table scans, free-tier performance surprises, or guessed statistics.
  if (intent === "monthly_absences") return failure("A view de frequência é histórica e não possui filtro mensal; não posso declarar alunos com mais de N faltas neste mês.", "vw_frequencia_resumo_aluno");
  if (intent === "pending_enrollments") return failure("A view de admissões conta candidaturas, não matrículas pendentes de conclusão.", "vw_admissoes_counts_por_status");
  if (intent === "missing_documents") return failure("Falta uma view validada dos documentos obrigatórios por aluno e ano letivo; os documentos emitidos não provam documentos em falta.", "documentos_emitidos / read-model de obrigatoriedade ausente");
  if (intent === "students_without_subject_grades") return failure("A view existente agrega notas pendentes por avaliação. Somá-las duplicaria alunos de uma mesma disciplina; falta uma view com alunos distintos por disciplina e período.", "vw_professor_pendencias");
  if (intent === "aged_tuitions") return failure("O radar disponível agrega devedores; não identifica cada mensalidade com vencimento superior ao limite. Não é seguro apresentar uma lista de mensalidades.", "vw_financeiro_inadimplencia_top_ano");
  if (intent === "official_failure_risk") return failure("O radar pedagógico atual é heurístico; não é o resolvedor oficial RAA de progressão. Sem read-model oficial de classificação de reprovação por turma, não é possível classificar turmas por risco.", "raa-progression-server / vw_risco_pedagogico_aluno");

  // Only the selected session's authenticated user is used. No service role.
  const supabase = await supabaseServerTyped();
  const auth = await supabase.auth.getUser();
  if (!auth.data.user || auth.data.user.id !== params.userId) return failure("Sessão não autenticada.", "Supabase Auth");
  const auditWindow = new Date(Date.now() - 60_000).toISOString();
  const [userRate, schoolRate] = await Promise.all([
    supabase.from("audit_logs").select("id", { count: "exact", head: true })
      .eq("escola_id", params.schoolId).eq("actor_id", auth.data.user.id)
      .eq("action", "AI_SCHOOL_INTELLIGENCE_READ").gte("created_at", auditWindow),
    supabase.from("audit_logs").select("id", { count: "exact", head: true })
      .eq("escola_id", params.schoolId).eq("action", "AI_SCHOOL_INTELLIGENCE_READ").gte("created_at", auditWindow),
  ]);
  if (userRate.error || schoolRate.error || userRate.count === null || schoolRate.count === null) {
    return failure("Não consegui verificar os limites de consultas; a consulta foi bloqueada.", "audit_logs");
  }
  if (userRate.count >= MAX_PER_USER_MINUTE || schoolRate.count >= MAX_PER_SCHOOL_MINUTE) {
    return failure("Limite de consultas atingido. Aguarde antes de repetir a pergunta.", "audit_logs");
  }
  const startedAt = performance.now();
  const signal = AbortSignal.timeout(5_500);
  const year = await resolveAcademicYearScope(supabase, { escolaId: params.schoolId,
    requestedAcademicYearId: checkedFilters.academicYearId, operation: "READ" });
  let response: DataCopilotResponse;
  if (intent === "teacher_grade_deadlines" || intent === "teacher_pending_details") {
    response = await teacherGrades(supabase, params.schoolId, params.role, year, intent, checkedFilters, signal);
  } else if (intent === "available_class_seats") {
    response = await availableSeats(supabase, params.schoolId, params.role, year, checkedFilters, signal);
  } else if (intent === "monthly_finance") {
    response = await monthlyFinance(supabase, params.schoolId, params.role, year, checkedFilters, signal);
  } else return failure("Consulta não disponível.", intent);
  // Only aggregate counts and safe parameter IDs appear in persistent audit.
  const aggregates = response.insight.evidence.flatMap(({ label, value }) =>
    /^\d+(?:\/\d+)?$/.test(value) ? [{ label, value }] : []);
  const { error: auditError } = await supabase.from("audit_logs").insert({
    escola_id: params.schoolId, actor_id: auth.data.user.id, actor_role: params.role,
    portal: "admin_escola", action: "AI_SCHOOL_INTELLIGENCE_READ", entity: "klasse_ai_intelligence",
    details: { tool: intent, version: "1", filters: checkedFilters, aggregates,
      status: response.insight.provenance?.freshness === "unknown" ? "unavailable" : "answered",
      duration_ms: Math.round(performance.now() - startedAt) },
  });
  if (auditError) return failure("Não foi possível registar a auditoria; a resposta foi bloqueada.", "audit_logs");
  if (response.insight.provenance?.freshness !== "unknown") {
    response.conversation = { userId: params.userId, schoolId: params.schoolId, poloId: null,
      intent, filters: checkedFilters, consultedAt: Date.now() };
  }
  return response;
}

async function teacherGrades(
  supabase: SupabaseClient<Database>, schoolId: string,
  role: string, year: AcademicYearScope, intent: IntelligenceIntent,
  filters: SchoolIntelligenceFilters, signal: AbortSignal,
): Promise<DataCopilotResponse> {
  const today = new Date();
  const { data: periods, error: periodError } = await supabase.from("periodos_letivos")
    .select("numero,data_inicio,data_fim,trava_notas_em")
    .eq("escola_id", schoolId).eq("ano_letivo_id", year.id).eq("tipo", "TRIMESTRE").limit(4).abortSignal(signal);
  if (periodError) throw periodError;
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Luanda", year: "numeric", month: "2-digit", day: "2-digit" }).format(today);
  const period = filters.trimester
    ? (periods ?? []).find((item) => item.numero === filters.trimester)
    : (periods ?? []).find((item) => item.data_inicio <= todayKey && todayKey <= item.data_fim);
  if (!period) return failure("Trimestre ambíguo ou inexistente no calendário. Indique 1.º, 2.º ou 3.º trimestre.", "periodos_letivos");
  if (!period.trava_notas_em) return failure("Sem prazo registado para o lançamento de notas neste trimestre.", "periodos_letivos.trava_notas_em");
  const { data: classes, count: totalClasses, error: classError } = await supabase.from("vw_turmas_para_matricula")
    .select("id,classe_nome,turma_nome", { count: "exact" }).eq("escola_id", schoolId).eq("ano_letivo", year.ano).limit(MAX_CLASS_ROWS).abortSignal(signal);
  if (classError) throw classError;
  if (totalClasses === null || totalClasses > MAX_CLASS_ROWS) return failure("Número de turmas superior ao limite de verificação; não vou contar amostras.", "vw_turmas_para_matricula");
  const scoped = (classes ?? []).filter((item) => !filters.classNumber ||
    new RegExp(`(^|[^0-9])${filters.classNumber}([^0-9]|$)`).test(item.classe_nome ?? ""));
  if (!scoped.length) return failure("Nenhuma turma encontrada no ano letivo e na classe escolhidos; não é possível inferir o total de docentes.", "vw_turmas_para_matricula");
  const turmaIds = scoped.map((item) => item.id).filter((id): id is string => Boolean(id));
  if (turmaIds.length !== scoped.length) return failure("Existem turmas sem identificador válido na fonte canónica.", "vw_turmas_para_matricula");
  // Denominator comes from the canonical teacher↔class↔subject assignment table,
  // never from the materialized pendency view. A mismatch fails closed.
  const { data: assignments, count: assignmentCount, error: assignmentError } = await supabase
    .from("turma_disciplinas_professores")
    .select("professor_id,turma_id,disciplina_id", { count: "exact" })
    .eq("escola_id", schoolId).in("turma_id", turmaIds)
    .limit(MAX_GRADE_ROWS).abortSignal(signal);
  if (assignmentError) throw assignmentError;
  if (assignmentCount === null || assignmentCount > MAX_GRADE_ROWS) return failure(
    "Atribuições excedem o limite de verificação; não é seguro calcular o denominador.",
    "turma_disciplinas_professores");
  const { data, count, error } = await supabase.from("vw_professor_pendencias")
    .select("professor_id,turma_id,turma_nome,disciplina_id,disciplina_nome,trimestre,tipo,avaliacao_id,total_alunos,notas_lancadas,pendentes", { count: "exact" })
    .eq("escola_id", schoolId).eq("trimestre", Number(period.numero))
    .in("turma_id", turmaIds).limit(MAX_GRADE_ROWS).abortSignal(signal);
  if (error) throw error;
  if (count === null || count > MAX_GRADE_ROWS) return failure("A view excedeu o limite de linhas; não vou tomar uma amostra como total.", "vw_professor_pendencias");
  if (!data?.length) return failure("Ainda não existem linhas de atribuição/avaliação para este trimestre; não é possível certificar zero pendências.", "vw_professor_pendencias");
  const rows: ProfessorGradeRow[] = (data ?? []).map((item) => ({
    ...item, trimestre: item.trimestre ?? 0, total_alunos: Number(item.total_alunos ?? 0),
    notas_lancadas: Number(item.notas_lancadas ?? 0), pendentes: Number(item.pendentes ?? 0),
  }));
  const coverage = verifyTeacherAssignmentCoverage(assignments ?? [], rows);
  if (!coverage.verified) return failure(
    `O denominador de docentes não está comprovado: ${coverage.unobserved} atribuições sem avaliação na view e ${coverage.unknown} avaliações sem atribuição atual. A atribuição encerrada e as avaliações previstas precisam de confirmação no calendário.`,
    "turma_disciplinas_professores + vw_professor_pendencias");
  const result = summarizeTeacherGrades(rows, period.trava_notas_em, today);
  if (!result.ok) return failure(result.reason, "vw_professor_pendencias + periodos_letivos");
  const delayed = [...result.pending, ...result.incomplete];
  const grouped = new Map<string, Set<string>>();
  for (const row of delayed) {
    if (!row.professor_id) continue;
    if (!grouped.has(row.professor_id)) grouped.set(row.professor_id, new Set());
    grouped.get(row.professor_id)?.add(`${safeDisplayText(row.turma_nome)} · ${safeDisplayText(row.disciplina_nome)}`);
  }
  const affected = [...grouped.entries()];
  const page = Math.min(filters.page ?? 0, 10);
  let details = "";
  if (intent === "teacher_pending_details" && affected.length) {
    const slice = affected.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const ids = slice.map(([id]) => id);
    const { data: teacherNames, error: namesError } = await supabase.from("vw_search_professores")
      .select("id,label").eq("escola_id", schoolId).in("id", ids).limit(PAGE_SIZE).abortSignal(signal);
    if (namesError) throw namesError;
    const names = new Map((teacherNames ?? []).map((row) => [row.id, safeDisplayText(row.label)]));
    details = slice.map(([teacherId, subjects], index) => {
      const all = [...subjects];
      const snippets = all.slice(0, 5).join("; ");
      return `${page * PAGE_SIZE + index + 1}. ${names.get(teacherId) ?? "Professor sem nome autorizado"} — ${snippets}${all.length > 5 ? `; e mais ${all.length - 5}` : ""}`;
    }).join("\n");
  }
  const openGrades = instantiateAssistantActionV2("academico:open_grades", role, { schoolId });
  return createDataCopilotResponse({ insight: {
    diagnosis: `**${result.teachersOverdue} de ${coverage.denominator} professores com atribuições comprovadas** têm lançamentos com prazo vencido.` +
      (details ? `\n\n${details}` : ""),
    impact: `Pendente (nada lançado): ${result.teachersPending} docentes, ${result.pendingAssessments} instrumentos. ` +
      `Incompleto (parte lançada): ${result.teachersIncomplete} docentes, ${result.incompleteAssessments} instrumentos. ` +
      `Ainda não exigível: ${result.teachersNotDue} docentes, ${result.notDueAssessments} instrumentos. ` +
      "Um docente pode constar tanto nas pendências como nos incompletos; o total em atraso é distinto.",
    recommendation: "Rever lançamentos por turma e disciplina na área de Notas. Esta é uma constatação factual de dados; não é uma acusação ao docente.",
    evidence: [
      { label: "Ano letivo", value: String(year.ano) }, { label: "Trimestre", value: String(period.numero) },
      { label: "Prazo de referência", value: String(period.trava_notas_em) },
      { label: "Turmas afetadas", value: String(result.affectedClasses) },
      { label: "Disciplinas afetadas", value: String(result.affectedDisciplines) },
      { label: "Docentes distintos em atraso", value: `${result.teachersOverdue}/${coverage.denominator}` },
      { label: "Página da lista", value: String(page + 1) },
    ], actions: openGrades ? [{ ...openGrades, label: "Ver área de Notas (confirmar filtros)" }] : [], provenance: { source: "academic-grade-gaps · vw_professor_pendencias + vw_turmas_para_matricula + periodos_letivos + vw_search_professores",
      consultedAt: today.toISOString(), scope: `Escola autorizada · ano ${year.ano} · ${period.numero}.º trimestre · classe ${filters.classNumber ?? "todas"} · sem segmentação por polo na fonte`, freshness: "partial",
      limitation: "A fonte de pendências é materializada e pode estar defasada até ao próximo refresh." },
  } });
}

async function availableSeats(
  supabase: SupabaseClient<Database>, schoolId: string,
  role: string, year: AcademicYearScope, filters: SchoolIntelligenceFilters, signal: AbortSignal,
): Promise<DataCopilotResponse> {
  const { data, count, error } = await supabase.from("vw_turmas_para_matricula")
    .select("id,turma_nome,classe_nome,capacidade_maxima,ocupacao_atual,status_validacao", { count: "exact" })
    .eq("escola_id", schoolId).eq("ano_letivo", year.ano).limit(MAX_CLASS_ROWS).abortSignal(signal);
  if (error) throw error;
  if (count === null || count > MAX_CLASS_ROWS) return failure("Existem mais turmas do que o limite da consulta; sem total verificável.", "vw_turmas_para_matricula");
  const filtered = (data ?? []).filter((row) => (!filters.classNumber ||
    new RegExp(`(^|[^0-9])${filters.classNumber}([^0-9]|$)`).test(row.classe_nome ?? "")) &&
    row.status_validacao === "ativo");
  if (filtered.some((row) => row.capacidade_maxima == null || row.ocupacao_atual == null)) {
    return failure("Pelo menos uma turma não tem capacidade/ocupação verificável.", "vw_turmas_para_matricula");
  }
  const available = filtered.filter((row) => Number(row.capacidade_maxima) > Number(row.ocupacao_atual) && Number(row.capacidade_maxima) > 0);
  const page = filters.page ?? 0;
  const lines = available.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    .map((row) => `${safeDisplayText(row.turma_nome)} (${safeDisplayText(row.classe_nome)}): ${Number(row.capacidade_maxima) - Number(row.ocupacao_atual)} vagas`);
  const openGrades = instantiateAssistantActionV2("academico:open_grades", role, { schoolId });
  return createDataCopilotResponse({ insight: {
    diagnosis: `**${available.length} de ${filtered.length} turmas ativas têm vagas disponíveis.**` + (lines.length ? `\n${lines.join("\n")}` : ""),
    impact: "Capacidade e ocupação são consultadas do read-model de matrículas; não representam reserva de vaga.",
    recommendation: "Confirmar a disponibilidade no momento da matrícula, pois a ocupação pode mudar.",
    evidence: [{ label: "Ano letivo", value: String(year.ano) }, { label: "Turmas com vagas", value: String(available.length) },
      { label: "Turmas verificadas", value: String(filtered.length) }, { label: "Página", value: String(page + 1) }],
    actions: openGrades ? [{ ...openGrades, label: "Abrir área académica" }] : [], provenance: { source: "available-class-seats · vw_turmas_para_matricula", consultedAt: new Date().toISOString(),
      scope: `Escola autorizada · ano ${year.ano} · classe ${filters.classNumber ?? "todas"}`, freshness: "partial",
      limitation: "O read-model de turmas pode ter atraso de atualização." },
  } });
}

async function monthlyFinance(
  supabase: SupabaseClient<Database>, schoolId: string,
  role: string, year: AcademicYearScope, filters: SchoolIntelligenceFilters, signal: AbortSignal,
): Promise<DataCopilotResponse> {
  const month = filters.month ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Luanda", year: "numeric", month: "2-digit" }).format(new Date());
  const { data, error } = await supabase.from("vw_financeiro_kpis_mes_ano")
    .select("previsto_total,realizado_total,pago_competencia_total,mes_ref")
    .eq("escola_id", schoolId).eq("ano_letivo_id", year.id).eq("mes_ref", `${month}-01`).abortSignal(signal).maybeSingle();
  if (error) throw error;
  if (!data) return failure("O read-model financeiro não disponibiliza um fecho verificável para este mês e ano letivo.", "vw_financeiro_kpis_mes_ano");
  if (data.previsto_total === null || data.realizado_total === null) {
    return failure("Faltam valores comprovados de previsto ou caixa no read-model.", "vw_financeiro_kpis_mes_ano");
  }
  const planned = Number(data.previsto_total);
  const received = Number(data.realizado_total);
  if (!Number.isFinite(planned) || !Number.isFinite(received)) return failure("Os montantes do read-model não são válidos.", "vw_financeiro_kpis_mes_ano");
  const openRadar = instantiateAssistantActionV2("finance:open_radar", role, { schoolId });
  return createDataCopilotResponse({ insight: {
    diagnosis: `**Previsto: ${AOA.format(planned)}. Recebido (caixa): ${AOA.format(received)}.**`,
    impact: "Previsto soma mensalidades por vencimento neste mês e ano letivo, excluindo canceladas. Caixa soma pagamentos liquidados na data efetiva do mês; aprovação pela Secretaria não é liquidação.",
    recommendation: "Reconciliar competência e caixa no Financeiro; são conceitos distintos e não devem ser subtraídos como saldo de dívida.",
    evidence: [{ label: "Mês (Luanda)", value: month }, { label: "Ano letivo", value: String(year.ano) },
      { label: "Previsto (competência)", value: AOA.format(planned) }, { label: "Recebido (caixa liquidado)", value: AOA.format(received) }],
    actions: openRadar ? [{ ...openRadar, label: "Abrir Financeiro" }] : [], provenance: { source: "monthly-finance · vw_financeiro_kpis_mes_ano", consultedAt: new Date().toISOString(),
      scope: `Escola autorizada · ano ${year.ano} · mês ${month}`, freshness: "partial",
      limitation: "View materializada: os lançamentos recentes podem aguardar atualização." },
  } });
}

export const schoolIntelligenceTool: DataCopilotTool = {
  id: "school-intelligence-catalog", module: "direcao", requiredPermission: "assistant.view",
  match: (query) => Boolean(classifySchoolQuestion(query)) || isStatisticalSchoolQuestion(query),
  run: runSchoolIntelligence,
};
