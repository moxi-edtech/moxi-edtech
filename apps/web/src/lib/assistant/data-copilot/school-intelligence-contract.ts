import { z } from "zod";
import { normalizeAssistantText } from "./query-matcher";
import { AI_ADMIN_ROLES } from "@/lib/roles/ai-roles";

/** No SQL or model-selected table names. All prompts route to this closed catalogue. */
export const INTELLIGENCE_INTENTS = [
  "teacher_grade_deadlines", "teacher_pending_details", "students_without_subject_grades",
  "monthly_absences", "pending_enrollments", "available_class_seats", "monthly_finance",
  "aged_tuitions", "missing_documents", "official_failure_risk",
] as const;
export type IntelligenceIntent = (typeof INTELLIGENCE_INTENTS)[number];

export const SchoolIntelligenceFiltersSchema = z.object({
  academicYearId: z.string().uuid().optional(),
  trimester: z.number().int().min(1).max(3).optional(),
  classNumber: z.number().int().min(1).max(13).optional(),
  turmaId: z.string().uuid().optional(),
  subject: z.string().trim().min(2).max(70).regex(/^[\p{L}\d\s.-]+$/u).optional(),
  threshold: z.number().int().min(0).max(366).optional(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  page: z.number().int().min(0).max(10).default(0),
}).strict();
export type SchoolIntelligenceFilters = z.input<typeof SchoolIntelligenceFiltersSchema>;

export const SchoolIntelligenceConversationSchema = z.object({
  userId: z.string().uuid(),
  schoolId: z.string().uuid(),
  /** Bind to an externally verified unit when the product has a polo model. */
  poloId: z.string().uuid().nullable().optional(),
  intent: z.enum(INTELLIGENCE_INTENTS),
  filters: SchoolIntelligenceFiltersSchema,
  consultedAt: z.number().int().positive(),
}).strict();
export type SchoolIntelligenceConversation = z.infer<typeof SchoolIntelligenceConversationSchema>;

const has = (q: string, expression: RegExp) => expression.test(q);

/** Deliberately deterministic. Negative/ambiguous prompts never hit provider or a guessed query. */
export function classifySchoolQuestion(question: string, previous?: SchoolIntelligenceConversation | null): IntelligenceIntent | null {
  const q = normalizeAssistantText(question);
  if (!q) return null;
  if (previous && /^(quais sao esses|quem sao esses|mostra so|mostre so|e na |e no |e os |detalha|detalhe|ver lista|proxima pagina|pagina seguinte|voltar pagina)/.test(q)) {
    return previous.intent === "teacher_grade_deadlines" && /quais sao esses|quem sao esses|detalh|ver lista/.test(q)
      ? "teacher_pending_details" : previous.intent;
  }
  const teachers = has(q, /professor|docente/);
  const grades = has(q, /notas?|pautas?|avaliac|lancament/);
  if (teachers && grades && has(q, /penden|atras|nao lanc|por lancar|falta|incomplet|quem|quais|quant/)) {
    return has(q, /quais|quem|nomes|lista|em que turmas|identifica/) ? "teacher_pending_details" : "teacher_grade_deadlines";
  }
  if (grades && has(q, /alunos?|estudant/) && has(q, /sem notas?|sem avaliac|nao tem notas?|falta|penden|nao receberam?/) && has(q, /disciplin|matemat|portugu|fisic|quimic|biolog|geograf|histori/)) {
    return "students_without_subject_grades";
  }
  if (has(q, /\bfaltas\b|\bfaltaram\b|\bfaltou\b|ausenc/) && has(q, /alunos?|estudant/) && has(q, /mes|mensal|neste|ultimo|mais de|acima de|quantos/)) return "monthly_absences";
  if (has(q, /matricul/) && has(q, /penden|concluir|conclusao|finalizar|por terminar|incomplet/)) return "pending_enrollments";
  if (has(q, /turmas?/) && has(q, /vaga|capacidade|lotac|disponive|lugares? livres?|livres?/)) return "available_class_seats";
  if (has(q, /previst|deveria|esperad|receb|caixa|arrecad|realizad/) && has(q, /receb|caixa|previst|deveria|arrecad/) && has(q, /mes|mensal|periodo|financeiro|receita|propina/)) return "monthly_finance";
  if (has(q, /mensalidad|propinas?/) && has(q, /vencid|atras|mais de|dias|antig|cobran/)) return "aged_tuitions";
  if (has(q, /alunos?|estudant/) && has(q, /document|processo/) && has(q, /falta|penden|incomplet|sem |ausent/)) return "missing_documents";
  if (has(q, /reprov|retenc|transic|passar de classe/) && has(q, /turma|alunos?|risco|maior|quais|quant/)) return "official_failure_risk";
  return null;
}

export function isStatisticalSchoolQuestion(question: string) {
  const q = normalizeAssistantText(question);
  return /\b(quantos?|quais|quem|lista|mostra|mostre|qual|quanto|total|numero|situacao|risco)\b/.test(q)
    && /\b(alun|professor|docent|turma|classe|matricul|notas?|faltas?|mensalidad|propina|receb|document|reprov|escola|avaliac)/.test(q);
}

export function extractSchoolFilters(question: string, base: SchoolIntelligenceFilters = {}): SchoolIntelligenceFilters {
  const q = normalizeAssistantText(question);
  const filters: SchoolIntelligenceFilters = { ...base, page: 0 };
  const trimester = q.match(/(?:1|primeir)[oa]?\s*(?:\.| )?\s*trimestre|(?:2|segund)[oa]?\s*(?:\.| )?\s*trimestre|(?:3|terceir)[oa]?\s*(?:\.| )?\s*trimestre|trimestre\s*([123])/);
  if (trimester) filters.trimester = trimester[1] ? Number(trimester[1]) : /^(?:1|primeir)/.test(trimester[0]) ? 1 : /^(?:2|segund)/.test(trimester[0]) ? 2 : 3;
  const classroom = q.match(/\b(\d{1,2})\s*\.?\s*([oa])?\s*classe\b|\bclasse\s*(\d{1,2})\b/);
  if (classroom) filters.classNumber = Number(classroom[1] ?? classroom[3]);
  const days = q.match(/(?:mais de|acima de|superior a)\s*(\d{1,3})\s*(?:dias?|vezes?|faltas?)/);
  if (days) filters.threshold = Number(days[1]);
  const subject = q.match(/(?:em|na disciplina de|de)\s+(matematica|portugues|fisica|quimica|biologia|geografia|historia)\b/);
  if (subject) filters.subject = subject[1];
  const month = q.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/);
  if (month) filters.month = `${month[1]}-${month[2].padStart(2, "0")}`;
  if (/proxima pagina|pagina seguinte/.test(q)) filters.page = Math.min((base.page ?? 0) + 1, 10);
  if (/voltar pagina/.test(q)) filters.page = Math.max((base.page ?? 0) - 1, 0);
  return SchoolIntelligenceFiltersSchema.parse(filters);
}

export type ProfessorGradeRow = {
  professor_id: string | null;
  turma_id: string | null;
  disciplina_id: string | null;
  turma_nome?: string | null;
  disciplina_nome?: string | null;
  trimestre: number;
  tipo: string | null;
  avaliacao_id: string | null;
  total_alunos: number;
  notas_lancadas: number;
  pendentes: number;
};

/** Strictly counts distinct assigned teachers and per-assessment states. */
export function summarizeTeacherGrades(rows: ProfessorGradeRow[], deadline: string | null, now: Date) {
  if (!deadline) return { ok: false as const, reason: "O calendário não tem prazo de lançamento (trava_notas_em)." };
  if (!Number.isFinite(new Date(deadline).getTime())) return { ok: false as const, reason: "Prazo inválido no calendário académico." };
  if (rows.length && rows.some((row) => !row.professor_id && row.total_alunos > 0)) {
    return { ok: false as const, reason: "Existem disciplinas com alunos mas sem professor atribuído." };
  }
  if (rows.some((row) => !Number.isSafeInteger(row.total_alunos) || row.total_alunos < 0 ||
    !Number.isSafeInteger(row.notas_lancadas) || row.notas_lancadas < 0 ||
    row.notas_lancadas > row.total_alunos || row.pendentes < 0)) {
    return { ok: false as const, reason: "Existem contagens inconsistentes no read-model de notas." };
  }
  const assigned = rows.filter((row) => row.professor_id && row.total_alunos > 0);
  const due = new Date(deadline).getTime() <= now.getTime();
  const pending = due ? assigned.filter((row) => row.pendentes > 0 && row.notas_lancadas === 0) : [];
  const incomplete = due ? assigned.filter((row) => row.pendentes > 0 && row.notas_lancadas > 0) : [];
  const notDue = due ? [] : assigned.filter((row) => row.pendentes > 0);
  const unique = (items: typeof rows, key: "professor_id" | "turma_id" | "disciplina_id") => new Set(items.map((row) => row[key]).filter(Boolean)).size;
  const delayed = [...pending, ...incomplete];
  return {
    ok: true as const, teachersAssigned: unique(assigned, "professor_id"),
    teachersOverdue: unique(delayed, "professor_id"),
    teachersPending: unique(pending, "professor_id"),
    teachersIncomplete: unique(incomplete, "professor_id"),
    teachersNotDue: unique(notDue, "professor_id"),
    pendingAssessments: pending.length, incompleteAssessments: incomplete.length,
    notDueAssessments: notDue.length, affectedClasses: unique(delayed, "turma_id"),
    affectedDisciplines: unique(delayed, "disciplina_id"),
    pending, incomplete, notDue, deadline,
  };
}

/** Never treat labels or observations from a database as instructions or markup. */
export function safeDisplayText(value: unknown) {
  return String(value ?? "").replace(/[<>\[\]{}()*_`~!|\\]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 90).trim();
}

export function canReadWholeSchoolIntelligence(role: string, query: string) {
  // A polo-scoped role must never see organizational results before the
  // canonical user↔polo↔entity binding is available in the schema.
  return AI_ADMIN_ROLES.includes(role.trim().toLowerCase()) &&
    !/\bpolo\b|\bcampus\b|\bunidade\b/i.test(query);
}

export function validIntelligenceContinuation(
  input: unknown, userId: string | undefined, schoolId: string, now = Date.now(),
) {
  const validated = SchoolIntelligenceConversationSchema.safeParse(input);
  if (!validated.success || !userId) return null;
  const candidate = validated.data;
  return candidate.userId === userId && candidate.schoolId === schoolId &&
    !candidate.poloId && candidate.consultedAt <= now &&
    now - candidate.consultedAt <= 15 * 60_000 ? candidate : null;
}
