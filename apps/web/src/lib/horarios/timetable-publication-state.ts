export type TimetablePublicationState = "sem_horario" | "rascunho" | "publicado";
export type TimetableVersion = { status: string | null; id: string };
export function timetablePublicationState(
  versions: ReadonlyArray<TimetableVersion>,
): TimetablePublicationState {
  if (versions.some((v) => v.status === "publicada")) return "publicado";
  if (versions.some((v) => v.status === "draft")) return "rascunho";
  return "sem_horario";
}
export const timetableStateLabels: Record<TimetablePublicationState, string> = {
  sem_horario: "Sem horário publicado ou guardado",
  rascunho: "Horário em rascunho — ainda não publicado",
  publicado: "Horário publicado",
};
