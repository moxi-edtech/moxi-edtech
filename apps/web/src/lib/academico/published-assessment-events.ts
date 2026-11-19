/** Student and teacher read the same published school assessments.
 * The MED calendar stays immutable; these are turma-specific operational events.
 * RLS on calendario_avaliacoes enforces student/guardian/teacher visibility.
 */
type PublishedAssessment = {
  id: string; turma_id: string; turma_disciplina_id: string; tipo: string;
  descricao: string | null; data: string; inicio: string; fim: string | null;
};
export type PublishedAssessmentEvent = {
  id: string; escola_id: string; nome: string; descricao: string | null;
  data_inicio: string; data_fim: string; tipo: string; publico_alvo: string;
  cor_hex: string; offering_id: null; source_template_id: null;
};

export async function readPublishedAssessmentEvents(
  supabase: any,
  input: {
    escolaId: string; anoLetivoId: string; turmaIds: string[];
    rangeStart: string; rangeEnd?: string; limit?: number;
  },
): Promise<PublishedAssessmentEvent[]> {
  const turmaIds = [...new Set(input.turmaIds)].filter(Boolean);
  if (turmaIds.length === 0) return [];
  if (turmaIds.length > 500) throw new Error("CALENDAR_ASSESSMENT_CLASS_LIMIT");

  let query = supabase.from("calendario_avaliacoes")
    .select("id,turma_id,turma_disciplina_id,tipo,descricao,data,inicio,fim")
    .eq("escola_id", input.escolaId)
    .eq("ano_letivo_id", input.anoLetivoId)
    .eq("estado", "publicado")
    .in("turma_id", turmaIds)
    .gte("data", input.rangeStart)
    .order("data", { ascending: true })
    .order("inicio", { ascending: true })
    .limit(input.limit ?? 120);
  if (input.rangeEnd) query = query.lte("data", input.rangeEnd);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as PublishedAssessment[];
  const ids = [...new Set(rows.map((v) => v.turma_disciplina_id))];
  if (!ids.length) return [];

  const { data: assignments, error: assignmentError } = await supabase
    .from("turma_disciplinas").select("id,curso_matriz_id")
    .eq("escola_id", input.escolaId).in("id", ids).limit(500);
  if (assignmentError) throw assignmentError;
  const matrixIds = [...new Set((assignments ?? []).map((v: any) => v.curso_matriz_id).filter(Boolean))] as string[];
  const { data: matrices, error: matrixError } = matrixIds.length
    ? await supabase.from("curso_matriz").select("id,disciplina_id")
      .eq("escola_id", input.escolaId).in("id", matrixIds).limit(500)
    : { data: [], error: null };
  if (matrixError) throw matrixError;
  const subjectIds = [...new Set((matrices ?? []).map((v: any) => v.disciplina_id).filter(Boolean))] as string[];
  const { data: subjects, error: subjectError } = subjectIds.length
    ? await supabase.from("disciplinas_catalogo").select("id,nome")
      .eq("escola_id", input.escolaId).in("id", subjectIds).limit(500)
    : { data: [], error: null };
  if (subjectError) throw subjectError;
  const names = new Map<string, string>((subjects ?? []).map((s: any) => [s.id, s.nome]));
  const matricesById = new Map<string, string>((matrices ?? []).map((m: any) => [m.id, names.get(m.disciplina_id) ?? "Disciplina"]));
  const assignmentNames = new Map<string, string>((assignments ?? []).map((a: any) => [a.id, matricesById.get(a.curso_matriz_id) ?? "Disciplina"]));

  return rows.map((row) => ({
    id: row.id, escola_id: input.escolaId,
    nome: row.tipo + " · " + (assignmentNames.get(row.turma_disciplina_id) ?? "Disciplina"),
    descricao: "Às " + row.inicio.slice(0, 5)
      + (row.fim ? "–" + row.fim.slice(0, 5) : "")
      + (row.descricao ? " · " + row.descricao : ""),
    data_inicio: row.data, data_fim: row.data, tipo: "AVALIACAO_ESCOLAR",
    publico_alvo: "turma", cor_hex: "#1F6B3B",
    offering_id: null, source_template_id: null,
  }));
}
