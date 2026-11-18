export type CurriculumDisciplineOption = {
  id: string;
  nome: string;
  class_ids: readonly string[];
};

export type SuspectedEquivalence = {
  classId: string;
  normalizedName: string;
  candidates: Array<{ id: string; nome: string }>;
};

export function normalizeCurricularDisciplineName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-AO")
    .replace(/\bed\s*\./g, "educacao ")
    .replace(/\bexp\s*\./g, "expressao ")
    .replace(/[.,;:()/_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Marca equivalências suspeitas, por classe, sem apagar, fundir ou
 * alterar a escolha feita pela escola. A mesma disciplina pode existir
 * em várias classes sem ser duplicação.
 */
export function findSuspectedSubjectEquivalences(
  disciplines: ReadonlyArray<CurriculumDisciplineOption>,
): SuspectedEquivalence[] {
  const grouped = new Map<string, SuspectedEquivalence>();
  for (const disc of disciplines) {
    const normalized = normalizeCurricularDisciplineName(disc.nome);
    if (!normalized) continue;
    for (const classId of new Set(disc.class_ids)) {
      const key = classId + ":" + normalized;
      const current = grouped.get(key) ?? {
        classId,
        normalizedName: normalized,
        candidates: [],
      };
      if (!current.candidates.some((candidate) => candidate.id === disc.id)) {
        current.candidates.push({ id: disc.id, nome: disc.nome });
      }
      grouped.set(key, current);
    }
  }
  return [...grouped.values()]
    .filter((entry) => entry.candidates.length > 1)
    .sort((a, b) => a.classId.localeCompare(b.classId) ||
      a.normalizedName.localeCompare(b.normalizedName));
}
