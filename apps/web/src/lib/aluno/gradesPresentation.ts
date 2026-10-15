/** A pauta só enumera períodos devolvidos pelo domínio; não inventa trimestres. */
export type GradeEntry = { nome: string; tipo: string; trimestre: number; nota: number };
export type GradeSubject = { id: string; nome: string; avaliacoes: GradeEntry[] };
export type AccessStatus = "available" | "pending" | "rejected" | "granted" | "unknown";
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
    case "pending": return {title:"Comprovativo em análise",message:"Recebemos o comprovativo. Aguarda a confirmação do pagamento pela secretaria; não precisas de pagar outra vez.",action:"Acompanhar pagamento"};
    case "rejected": return {title:"Comprovativo rejeitado",message:reason?.trim() || "A secretaria rejeitou o comprovativo. Consulta o pedido para saber o motivo.",action:"Reenviar no mesmo pedido"};
    case "available": return {title:"Notas disponíveis após pagamento",message:"Para consultar as avaliações, efetua o pagamento e aguarda a confirmação da secretaria.",action:"Pagar boletim"};
    case "granted": return {title:"Acesso em reconciliação",message:"A secretaria ainda não confirmou todas as condições de acesso. Não efetues um novo pagamento.",action:"Acompanhar pagamento"};
    default: return {title:"Não foi possível confirmar o pagamento",message:"Consulta o estado do pedido na Secretaria Digital. Não efetues um novo pagamento.",action:"Ver pedido"};
  }
}
