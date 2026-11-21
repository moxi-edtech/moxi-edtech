/** A school-scoped, pre-aggregated occupancy row. */
export type OcupacaoRow = {
  id: string;
  escola_id: string;
  nome: string | null;
  classe: string | null;
  turno: string | null;
  sala: string | null;
  capacidade_maxima: number | null;
  total_matriculas_ativas: number | null;
  ocupacao_percentual: number | null;
  status_ocupacao: string | null;
};

/** Group totals are page-local: never represent them as school-wide KPIs. */
export function groupOccupancyPage(rows: ReadonlyArray<OcupacaoRow>) {
  const byGroup = new Map<string, {
    classe: string | null;
    turno: string | null;
    capacidade_total: number;
    matriculas_ativas_total: number;
    ocupacao_media: number;
    turmas: OcupacaoRow[];
  }>();
  for (const row of rows) {
    const key = JSON.stringify([row.classe, row.turno]);
    const capacidade = Number(row.capacidade_maxima) || 0;
    const ativos = Number(row.total_matriculas_ativas) || 0;
    const group = byGroup.get(key);
    if (!group) {
      byGroup.set(key, {
        classe: row.classe,
        turno: row.turno,
        capacidade_total: capacidade,
        matriculas_ativas_total: ativos,
        ocupacao_media: 0,
        turmas: [row],
      });
    } else {
      group.capacidade_total += capacidade;
      group.matriculas_ativas_total += ativos;
      group.turmas.push(row);
    }
  }
  return [...byGroup.values()].map(group => ({
    ...group,
    ocupacao_media: group.capacidade_total > 0
      ? Math.round(group.matriculas_ativas_total / group.capacidade_total * 1000) / 10
      : 0,
  }));
}
