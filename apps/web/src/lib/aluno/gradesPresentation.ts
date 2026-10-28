/** A pauta só enumera períodos devolvidos pelo domínio; não inventa trimestres. */
export type GradeEntry = { nome: string; tipo: string; trimestre: number; nota: number };
export type TrimestreGrade = {
  trimestre: number;
  nota: number | null;
  status: "disponivel" | "pendente";
};
/** Null means that the school has not supplied an authoritative period assignment. */
export type GradeSubject = {
  id: string;
  nome: string;
  avaliacoes: GradeEntry[];
  periodosAtivos?: number[] | null;
  classificacoes?: TrimestreGrade[];
};

/** Trimestre visibility follows the assignment, never the presence of a score. */
export function isSubjectOffered(subject: GradeSubject, trimester: number): boolean | null {
  if (!Array.isArray(subject.periodosAtivos)) return null;
  return subject.periodosAtivos.includes(trimester);
}
export function subjectsInTrimester(subjects: GradeSubject[], trimester: number): GradeSubject[] {
  // Missing curriculum configuration is UNKNOWN, not an assertion of absence.
  return subjects.filter(subject => isSubjectOffered(subject, trimester) !== false);
}
/** Only accepted, ready-to-display classifications are shown in the summary. */
export function trimesterClassification(subject: GradeSubject, trimester: number): TrimestreGrade | null {
  const grade = subject.classificacoes?.find(value => value.trimestre === trimester) ?? null;
  return grade?.status === "disponivel" && typeof grade.nota === "number" && Number.isFinite(grade.nota)
    ? grade
    : null;
}
export function trimesterStatus(subject: GradeSubject, trimester: number): "nao_lecionada" | "desconhecida" | "pendente" | "sem_classificacao" | "disponivel" {
  const offered = isSubjectOffered(subject, trimester);
  if (offered === false) return "nao_lecionada";
  if (offered === null) return "desconhecida";
  if (trimesterClassification(subject, trimester)) return "disponivel";
  return subject.classificacoes?.some(c => c.trimestre === trimester && c.status === "pendente")
    ? "pendente"
    : "sem_classificacao";
}
export type AccessStatus = "available" | "pending_payment" | "pending" | "rejected" | "granted" | "unknown";
export function availablePeriods(subjects: GradeSubject[]): number[] {
  return [...new Set(subjects.flatMap(d => d.avaliacoes.map(a => a.trimestre)))]
    .filter(n => Number.isInteger(n) && n > 0).sort((a,b) => a-b);
}
export function chooseInitialPeriod(subjects: GradeSubject[], current: number | null = null): number | null {
  const periods = availablePeriods(subjects);
  if (current !== null && periods.includes(current)) return current;
  return periods.length ? periods[periods.length-1] : null;
}
export function periodAssessments(subject: GradeSubject, period: number | null): GradeEntry[] {
  if (period === null) return [];
  return subject.avaliacoes.filter(a => a.trimestre === period && Number.isFinite(a.nota));
}
/** Locale only; no hard-coded grading scale, rounding to a fabricated precision or averages. */
export function formatPublishedGrade(value: number): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat("pt-AO",{maximumFractionDigits:12,useGrouping:false}).format(value);
}
export function accessPresentation(status: AccessStatus, reason?: string | null) {
  switch(status) {
    case "pending_payment": return {title:"Pagamento por concluir",message:"Continua o pagamento do boletim.",action:"Continuar pagamento"};
    case "pending": return {title:"Pagamento em análise",message:"A secretaria está a verificar o comprovativo.",action:"Acompanhar pedido"};
    case "rejected": return {title:"Comprovativo rejeitado",message:reason?.trim() || "Corrige o comprovativo para continuar.",action:"Corrigir comprovativo"};
    case "available": return {title:"Consulta as tuas notas",message:"Solicita o boletim para aceder às avaliações.",action:"Solicitar boletim"};
    case "granted": return {title:"Acesso em atualização",message:"O boletim ainda não foi liberado. Consulta o pedido existente.",action:"Ver pedido"};
    default: return {title:"Acesso por confirmar",message:"Não foi possível consultar a situação do boletim.",action:"Ver pedido"};
  }
}
