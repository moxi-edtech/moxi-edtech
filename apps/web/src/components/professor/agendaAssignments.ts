export type AgendaAssignment = {
  turma_id?: string | null;
  disciplina_id?: string | null;
  turma_nome?: string | null;
  disciplina_nome?: string | null;
};

export async function loadAgendaAssignments(initial?: readonly AgendaAssignment[]) {
  if (initial) return initial;
  const response = await fetch("/api/professor/agenda", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok || !data?.ok || !Array.isArray(data.items)) {
    throw new Error("Não foi possível carregar as atribuições do horário.");
  }
  return data.items as AgendaAssignment[];
}
