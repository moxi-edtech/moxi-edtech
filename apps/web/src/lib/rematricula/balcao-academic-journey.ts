import type { BalcaoAcademicOperation } from "./balcao-academic-operation";

export type BalcaoAcademicContext = {
  can_manage: boolean; ano_ativo: boolean; hoje_angola: string;
  source: { id: string; turma_id: string; status: string; ativo: boolean };
  regime: { escala: string; eh_classe_exame: boolean; exames_aplicaveis: string[] };
  disciplinas: Array<{ id: string; nome: string }>;
  turma_disciplinas: Array<{ id: string; avaliacao_disciplina_id: string }>;
  periodos: Array<{ id: string; numero: number; data_inicio: string; data_fim: string }>;
  resultados: Array<{ id: string; nota: number; exame_sessao_id: string; exame_componente_id: string; turma_disciplina_id: string; estado: string; disciplina_nome?: string }>;
  sessoes: Array<{ id: string; tipo: string; data_inicio: string; estado: string; pendencias_publicacao: number;
    participantes_pendentes: Array<{ matricula_id: string; disciplina_id: string; nome: string; disciplina_nome: string }>;
    componentes: Array<{ id: string; codigo: string; nota_max: number }> }>;
  evidencias: Array<{ id: string; disciplina_id: string; suficiente: boolean }>;
  frequencias: Array<{ periodo_id: string; numero: number; data_fim: string; aulas_previstas: number | null;
    presencas: number | null; evidence_id: string | null; documento_fonte: string | null; version: string; pode_corrigir: boolean }>;
};
export type ExamJourneyStep = {
  action: Extract<BalcaoAcademicOperation["acao"], "abrir_exame" | "lancar_exame" | "validar_exame" | "publicar_exame">;
  title: string; detail: string; componenteId?: string; resultadoId?: string; disabled?: boolean;
};

/** Navigation only: eligibility and publication authorization remain server decisions. */
export function nextBalcaoExamStep(ctx: BalcaoAcademicContext, sessionId: string, disciplineId: string): ExamJourneyStep {
  const session = ctx.sessoes.find((s) => s.id === sessionId);
  if (!session) return { action: "abrir_exame", title: "Abrir sessão de exame", detail: "Confirme o tipo, os componentes e as datas da prova." };
  if (session.data_inicio > ctx.hoje_angola) return { action: "lancar_exame", title: "Aguardar a data da prova", detail: `A sessão começa em ${session.data_inicio}. O lançamento fica disponível nessa data.`, disabled: true };
  const td = ctx.turma_disciplinas.find((d) => d.avaliacao_disciplina_id === disciplineId);
  if (!td) return { action: "lancar_exame", title: "Escolher a disciplina do exame", detail: "Selecione a disciplina para continuar sem sair da ficha.", disabled: true };
  const results = ctx.resultados.filter((r) => r.exame_sessao_id === session.id && r.turma_disciplina_id === td.id && r.estado !== "anulado");
  const missing = session.componentes.find((c) => !results.some((r) => r.exame_componente_id === c.id));
  if (missing) return { action: "lancar_exame", title: `Lançar componente: ${missing.codigo}`, detail: "Registe a nota obtida; a validação será a etapa seguinte.", componenteId: missing.id };
  const submitted = results.find((r) => r.estado === "submetido");
  if (submitted) return { action: "validar_exame", title: "Validar o próximo componente", detail: "Confira a disciplina, o componente e a nota antes de confirmar.", resultadoId: submitted.id };
  if (session.componentes.length === 0) return { action: "abrir_exame", title: "Sessão sem componentes", detail: "Esta sessão não permite lançar resultados. Abra uma sessão completa.", disabled: true };
  if (session.pendencias_publicacao > 0) return { action: "publicar_exame", title: "Resolver os componentes restantes", detail: `Há ${session.pendencias_publicacao} componente(s) por lançar ou validar nesta sessão. Confira a disciplina ou resolva os participantes pendentes abaixo, nesta ficha, antes de publicar.`, disabled: true };
  return { action: "publicar_exame", title: "Encerrar e publicar resultados do exame", detail: "Os componentes registados estão validados. A publicação encerra a sessão e reavalia a rematrícula." };
}

export function nextBalcaoEjaStep(ctx: BalcaoAcademicContext): { action: "registar_eja" | "registar_frequencia_eja"; disciplineId?: string; periodId?: string; title: string } | null {
  const missing = ctx.disciplinas.find((d) => !ctx.evidencias.some((e) => e.disciplina_id === d.id));
  if (missing) return { action: "registar_eja", disciplineId: missing.id, title: `Conferir avaliação: ${missing.nome}` };
  const frequency = ctx.frequencias.find((f) => f.aulas_previstas == null || f.aulas_previstas <= 0 || f.presencas == null);
  if (frequency) return { action: "registar_frequencia_eja", periodId: frequency.periodo_id, title: `Conferir frequência: ${frequency.numero}.º trimestre` };
  const total = ctx.frequencias.reduce((sum, f) => sum + (f.aulas_previstas ?? 0), 0);
  const attended = ctx.frequencias.reduce((sum, f) => sum + (f.presencas ?? 0), 0);
  if (total > 0 && attended * 3 < total * 2) {
    const insufficient = ctx.frequencias.find((f) => (f.presencas ?? 0) * 3 < (f.aulas_previstas ?? 0) * 2);
    if (insufficient) return { action: "registar_frequencia_eja", periodId: insufficient.periodo_id, title: `Rever frequência oficial insuficiente: ${insufficient.numero}.º trimestre` };
  }
  const negative = ctx.evidencias.find((e) => !e.suficiente);
  if (negative) return { action: "registar_eja", disciplineId: negative.disciplina_id, title: `Rever avaliação não suficiente: ${ctx.disciplinas.find((d) => d.id === negative.disciplina_id)?.nome ?? "disciplina"}` };
  return null;
}
