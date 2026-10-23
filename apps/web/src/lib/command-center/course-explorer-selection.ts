/**
 * Course explorer selection is scoped to the requested school/course/year.
 * The dialog can remain mounted while its context changes.
 */
export type CourseExplorerSelection = {
  contextKey: string;
  classeId: string | null;
  turmaId: string | null;
};

/**
 * Invalid or stale filters must never turn a course that has turmas into a
 * false "Sem turmas" state. The selected class/turma must exist in the
 * currently loaded year-scoped list, otherwise it is cleared.
 */
export function resolveCourseExplorerSelection(input: {
  contextKey: string;
  selection: CourseExplorerSelection;
  fallback: { classeId: string | null; turmaId: string | null };
  classes?: ReadonlyArray<{ id: string }>;
  turmas?: ReadonlyArray<{ id: string; classeId: string | null }>;
}): CourseExplorerSelection {
  const selected = input.selection.contextKey === input.contextKey
    ? input.selection
    : { contextKey: input.contextKey, ...input.fallback };
  const classeId = input.classes &&
    !input.classes.some((classe) => classe.id === selected.classeId)
    ? null : selected.classeId;
  const turmaId = input.turmas &&
    !input.turmas.some((turma) => turma.id === selected.turmaId &&
      (!classeId || turma.classeId === classeId))
    ? null : selected.turmaId;

  return { contextKey: input.contextKey, classeId, turmaId };
}
