export type StudentDocument = {
  codigo: string;
  status: string;
  reject_reason?: string | null;
  valor?: number | null;
  next_action?: { label?: string; href?: string } | null;
};
export type StudentRematricula = {
  eligible?: boolean;
  alreadyDone?: boolean;
  hasDebt?: boolean;
  code?: string | null;
  reason?: string | null;
  nextAno?: number | null;
  rematricula?: { paymentIntent?: { status: string; rejection_reason?: string | null; has_evidence?: boolean } | null } | null;
};
export type Attention = {
  kind: "rejected" | "rematricula" | "pending" | "mensalidade" | "documento" | "academico";
  title: string;
  description: string;
  action: string;
  href: string;
  priority: number;
};
export type DashboardSituation = {
  pendentes: number;
  financialError?: boolean;
  documentos?: StudentDocument[] | null;
  rematricula?: StudentRematricula | null;
  academic?: { status: string; mensagem: string } | null;
};
const docsHref = "/aluno/documentos";
export function buildStudentAttention(s: DashboardSituation): Attention[] {
  const items: Attention[] = [];
  const docs = s.documentos ?? [];
  const rejected = docs.find(d => d.status === "rejected" && d.codigo === "DOC_BOLETIM_TRIMESTRAL")
    ?? docs.find(d => d.status === "rejected");
  if (rejected) items.push({
    kind: "rejected", priority: 0, title: "Comprovativo não aceite",
    description: rejected.reject_reason?.trim() || "O comprovativo precisa de ser corrigido.",
    action: "Reenviar no mesmo pedido", href: docsHref,
  });
  const payment = s.rematricula?.rematricula?.paymentIntent;
  if (payment?.status === "failed") items.push({
    kind: "rejected", priority: 0, title: "Comprovativo da rematrícula rejeitado",
    description: payment.rejection_reason?.trim() || "Corrige o comprovativo para continuar.",
    action: "Corrigir a rematrícula", href: "/aluno/academico",
  });
  if (s.rematricula?.eligible && !s.rematricula.alreadyDone) {
    if (payment?.status === "pending" && payment.has_evidence) items.push({
      kind: "pending", priority: 2, title: "Rematrícula em análise",
      description: "A secretaria está a verificar o pagamento.",
      action: "Acompanhar rematrícula", href: "/aluno/academico",
    });
    else if (payment?.status !== "settled" && payment?.status !== "failed") items.push({
      kind: "rematricula", priority: 1, title: "A tua rematrícula está disponível",
      description: s.rematricula.nextAno ? `Disponível para ${s.rematricula.nextAno}.` : "Já podes iniciar a rematrícula.",
      action: "Ver rematrícula", href: "/aluno/academico",
    });
  }
  const pending = docs.find(d => d.status === "pending" && d.codigo === "DOC_BOLETIM_TRIMESTRAL")
    ?? docs.find(d => d.status === "pending");
  if (pending) items.push({
    kind: "pending", priority: 2, title: "Documento em análise",
    description: "A secretaria está a verificar o teu pedido.",
    action: "Acompanhar pedido", href: docsHref,
  });
  if (s.pendentes > 0 && !s.financialError) items.push({
    kind: "mensalidade", priority: 3, title: s.pendentes === 1 ? "1 mensalidade vencida" : `${s.pendentes} mensalidades vencidas`,
    description: "Consulta o saldo e os pagamentos.",
    action: "Ver pagamentos", href: "/aluno/financeiro",
  });
  const blockedDoc = docs.find(d => d.status === "blocked");
  if (blockedDoc) items.push({
    kind: "documento", priority: 4, title: "Documento em análise",
    description: "A secretaria está a tratar do teu pedido.",
    action: "Acompanhar documento", href: docsHref,
  });
  // Um resultado ainda incompleto durante o ano não é uma pendência do aluno.
  // Estados académicos graves continuam acessíveis com uma ação de consulta.
  if (s.academic && ["retido", "reprovado"].includes(s.academic.status)) items.push({
    kind: "academico", priority: 5, title: "Consulta a tua situação escolar",
    description: s.academic.mensagem,
    action: "Ver situação académica", href: "/aluno/academico",
  });
  // Um único assunto por origem: a rejeição prevalece sobre o estado pendente da mesma solicitação.
  return items.filter(item => !(item.kind === "pending" && item.href === docsHref && rejected))
    .sort((a,b) => a.priority - b.priority);
}

export type Lesson = { weekday: number | null; inicio: string | null; fim?: string | null; sala?: string | null; disciplina?: string | null; professor?: string | null };
export function nextLessonLabel(lesson: Lesson | null | undefined): {day: string; time: string; subject: string; details: string[]} | null {
  if (!lesson || !Number.isInteger(lesson.weekday) || (lesson.weekday ?? 0) < 1 || (lesson.weekday ?? 0) > 7 ||
      !lesson.inicio || !/^([01]\d|2[0-3]):[0-5]\d/.test(lesson.inicio)) return null;
  const names = ["Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado","Domingo"];
  return { day: names[(lesson.weekday as number)-1], time: lesson.inicio.slice(0,5),
    subject: lesson.disciplina?.trim() || "Aula programada",
    details: [lesson.professor?.trim() ? `Professor: ${lesson.professor.trim()}` : "", lesson.sala?.trim() ? `Sala: ${lesson.sala.trim()}` : ""].filter(Boolean) };
}
