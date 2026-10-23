/**
 * The workspace's "Nova matrícula" action is a fresh application, not an
 * operation on the student currently being served. A prior application is
 * loaded only after an explicit "Retomar rascunho" choice.
 *
 * Other entrypoints retain their existing candidate-ID resolution contract.
 */
export function resolveEnrollmentCandidateId({
  newCandidateOnly,
  modalContext,
  resumedId,
  initialId,
  queryId,
}: {
  newCandidateOnly: boolean;
  modalContext: boolean;
  resumedId?: string | null;
  initialId?: string | null;
  queryId?: string | null;
}): string | null {
  if (newCandidateOnly) return resumedId ?? null;
  return (modalContext ? (resumedId || initialId) : (initialId || queryId)) ?? null;
}
