export type ActivityFamily = "financeiro" | "academico" | "documentos" | "secretaria" | "operacional";

export type ActivityFeedItem = {
  id: string;
  escola_id: string;
  occurred_at: string;
  event_family: ActivityFamily;
  event_type: string;
  actor_name: string | null;
  headline: string;
  subline: string | null;
  amount_kz: number | null;
  turma_nome: string | null;
  aluno_nome: string | null;
  payload: Record<string, unknown>;
};

export function familyLabel(family: string): string {
  switch (family) {
    case "financeiro":
      return "Financeiro";
    case "academico":
      return "Académico";
    case "documentos":
      return "Documentos";
    case "secretaria":
      return "Secretaria";
    default:
      return "Operacional";
  }
}

export function familyBadgeClasses(family: string): string {
  switch (family) {
    case "financeiro":
      return "bg-emerald-50 text-emerald-700";
    case "academico":
      return "bg-blue-50 text-blue-700";
    case "documentos":
      return "bg-purple-50 text-purple-700";
    case "secretaria":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function toFeedSubline(item: ActivityFeedItem): string | null {
  const actor = item.actor_name?.trim();
  if (item.subline?.trim()) return item.subline;
  if (item.aluno_nome?.trim()) return item.aluno_nome;
  if (item.turma_nome?.trim()) return item.turma_nome;
  return actor ? `Por ${actor}` : null;
}
