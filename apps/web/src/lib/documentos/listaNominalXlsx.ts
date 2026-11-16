import * as XLSX from "xlsx";
import { LISTA_NOMINAL_MODES, type ListaNominalMode } from "@/lib/documentos/listaNominalPolicy";

/** Exportação nominal simples, distinta da pauta digital (notas). */
export type NominalXlsxRow = {
  chamada: number | null;
  processo: string;
  nome: string;
  turma: string;
  ano: string;
  situacao: string;
};

/**
 * Defesa em profundidade contra fórmulas em células provenientes de dados do aluno.
 * Todas as colunas textuais são também gravadas como células XLSX de tipo string.
 */
export function safeNominalXlsxText(value: string): string {
  return /^[\s\uFEFF\u200B]*[=+\-@]/u.test(value) ? "'" + value : value;
}

export function renderNominalXlsx(input: {
  escola: string;
  turma: string;
  ano: string;
  mode: ListaNominalMode;
  totalOrigem: number;
  exclusoes: string;
  rows: readonly NominalXlsxRow[];
}): Buffer {
  const tx = (value: string) => safeNominalXlsxText(value);
  const lines: Array<Array<string | number>> = [
    ["KLASSE | LISTA NOMINAL"],
    ["Escola", tx(input.escola)],
    ["Turma", tx(input.turma), "Ano letivo", tx(input.ano)],
    ["Modo", LISTA_NOMINAL_MODES[input.mode]],
    ["Matrículas consultadas", input.totalOrigem, "Incluídas", input.rows.length, "Excluídas", input.totalOrigem - input.rows.length],
    ["Exclusões por estado", tx(input.exclusoes)],
    [],
    ["Nº de chamada", "Nº de processo", "Nome completo", "Turma", "Ano letivo", "Situação"],
    ...input.rows.map((row) => [
      row.chamada ?? "",
      tx(row.processo),
      tx(row.nome),
      tx(row.turma),
      tx(row.ano),
      tx(row.situacao),
    ]),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(lines);
  sheet["!cols"] = [
    { wch: 22 }, { wch: 25 }, { wch: 56 },
    { wch: 32 }, { wch: 18 }, { wch: 20 },
  ];
  sheet["!autofilter"] = { ref: `A8:F${Math.max(8, 8 + input.rows.length)}` };
  // Nunca serializar strings como fórmulas ou valores numéricos inferidos.
  for (const [address, cell] of Object.entries(sheet)) {
    if (address.startsWith("!")) continue;
    if (cell && typeof cell === "object" && "v" in cell && typeof cell.v === "string") {
      cell.t = "s";
      delete cell.f;
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Lista nominal");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
