/**
 * Regra canónica para listas de turma/classe/lote. A sessão académica é o
 * recorte; "ativo" só significa actividade operacional no momento.
 * Não decidir estado académico nem alterar qualquer matrícula.
 */
export type ListaNominalMode = "ano_letivo" | "operacional";
export type ListaNominalCategoria =
  | "activa" | "concluida" | "transferida" | "trancada"
  | "cancelada" | "pendente" | "desconhecida";
export type MatriculaParaLista = { status: string | null; ativo: boolean | null };
export const LISTA_NOMINAL_MODES: Record<ListaNominalMode, string> = {
  ano_letivo: "Lista do ano letivo (histórica)",
  operacional: "Lista operacional actual",
};
/** Ordenação única por turma, chamada, nome e processo para PDF e Excel. */
export function compareNominalSortableRows(
  a: { turma: string; chamada: number | null; nome: string; processo: string },
  b: { turma: string; chamada: number | null; nome: string; processo: string },
): number {
  return a.turma.localeCompare(b.turma, "pt-PT", { numeric: true, sensitivity: "base" }) ||
    (a.chamada ?? Number.MAX_SAFE_INTEGER) - (b.chamada ?? Number.MAX_SAFE_INTEGER) ||
    a.nome.localeCompare(b.nome, "pt-PT") ||
    a.processo.localeCompare(b.processo, "pt-PT");
}

export function classifyMatricula(status: string | null): ListaNominalCategoria {
  const v = (status ?? "").trim().toLocaleLowerCase("pt-PT").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["ativo", "ativa", "active"].includes(v)) return "activa";
  if (["concluido", "concluida"].includes(v)) return "concluida";
  if (["transferido", "transferida"].includes(v)) return "transferida";
  if (["trancado", "trancada"].includes(v)) return "trancada";
  if (["cancelado", "cancelada"].includes(v)) return "cancelada";
  if (["pendente", "pending"].includes(v)) return "pendente";
  return "desconhecida";
}
export function selectMatriculasDaLista<T extends MatriculaParaLista>(
  matriculas: readonly T[], mode: ListaNominalMode, includeAllStatus = false
): { incluidos: T[]; excluidos: Record<ListaNominalCategoria, number>; totalOrigem: number } {
  const incluidos: T[] = [];
  const excluidos: Record<ListaNominalCategoria, number> = {
    activa: 0, concluida: 0, transferida: 0, trancada: 0,
    cancelada: 0, pendente: 0, desconhecida: 0,
  };
  for (const matricula of matriculas) {
    const categoria = classifyMatricula(matricula.status);
    const incluir = includeAllStatus ||
      (mode === "ano_letivo"
        ? ["activa", "concluida", "transferida", "trancada"].includes(categoria)
        : categoria === "activa" && matricula.ativo === true);
    if (incluir) incluidos.push(matricula);
    else excluidos[categoria] += 1;
  }
  return { incluidos, excluidos, totalOrigem: matriculas.length };
}
export function resumoExclusoes(excluidos: Record<ListaNominalCategoria, number>): string {
  const rotulos: Record<ListaNominalCategoria, string> = {
    activa: "inactivas", concluida: "concluídas", transferida: "transferidas",
    trancada: "trancadas", cancelada: "canceladas", pendente: "pendentes",
    desconhecida: "estado desconhecido",
  };
  const parts = (Object.keys(excluidos) as ListaNominalCategoria[])
    .filter((key) => excluidos[key] > 0)
    .map((key) => rotulos[key] + ": " + excluidos[key]);
  return parts.length ? parts.join("; ") : "nenhuma";
}
export function modoPadraoDaSessao(sessaoActiva: boolean | null | undefined): ListaNominalMode {
  return sessaoActiva === true ? "operacional" : "ano_letivo";
}
