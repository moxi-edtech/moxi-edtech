import { renderNominalA4, type NominalA4Row } from "@/lib/documentos/nominalA4";
import type { AlunosPdfInstitutionalContext } from "@/lib/services/alunosExportPdfContext.server";
import * as XLSX from "xlsx";
import type { AlunoListItem } from "@/lib/schemas/aluno.schema";

const EXPORT_HEADERS = [
  { key: "nome", label: "Nome" },
  { key: "email", label: "Email" },
  { key: "responsavel", label: "Responsavel" },
  { key: "telefone_responsavel", label: "Telefone" },
  { key: "status", label: "Status" },
  { key: "turma_nome", label: "Turma" },
  { key: "classe_nome", label: "Classe" },
  { key: "turno", label: "Turno" },
  { key: "bolsa_integral", label: "Bolseiro" },
  { key: "total_em_atraso", label: "Total em atraso" },
  { key: "numero_processo_login", label: "Login" },
  { key: "numero_processo", label: "Processo" },
  { key: "origem", label: "Origem" },
  { key: "created_at", label: "Criado em" },
] as const;

type ExportFormat = "excel" | "pdf" | "csv";

export function parseAlunoExportFormat(value: string | null): ExportFormat {
  if (value === "pdf") return "pdf";
  if (value === "csv") return "csv";
  return "excel";
}

export function sortAlunoExportRows(items: AlunoListItem[]) {
  return [...items].sort((a, b) => {
    const nomeA = (a.nome ?? "").toLocaleLowerCase("pt-AO");
    const nomeB = (b.nome ?? "").toLocaleLowerCase("pt-AO");
    const compare = nomeA.localeCompare(nomeB, "pt-AO", { sensitivity: "base" });
    if (compare !== 0) return compare;
    return (a.id ?? "").localeCompare(b.id ?? "");
  });
}

function valueFor(row: AlunoListItem, key: (typeof EXPORT_HEADERS)[number]["key"]) {
  const value = (row as Record<string, unknown>)[key];
  if (value === null || value === undefined) return "";
  if (key === "created_at" && typeof value === "string") return value.slice(0, 10);
  if (key === "bolsa_integral") return value === true ? "Sim" : value === false ? "Não" : "";
  if (key === "turno" && typeof value === "string") {
    const normalized = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalized === "m" || normalized.startsWith("manha")) return "Manhã";
    if (normalized === "t" || normalized.startsWith("tarde")) return "Tarde";
    if (normalized === "n" || normalized.startsWith("noite")) return "Noite";
  }
  return String(value);
}

function toExportObjects(items: AlunoListItem[]) {
  return items.map((row) =>
    Object.fromEntries(EXPORT_HEADERS.map((header) => [header.label, valueFor(row, header.key)]))
  );
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function renderAlunosCsv(items: AlunoListItem[]) {
  const lines = [EXPORT_HEADERS.map((header) => header.label).join(",")];
  for (const row of items) {
    lines.push(EXPORT_HEADERS.map((header) => escapeCsv(valueFor(row, header.key))).join(","));
  }
  return `\ufeff${lines.join("\n")}`;
}

export function renderAlunosXlsx(items: AlunoListItem[]) {
  const worksheet = XLSX.utils.json_to_sheet(toExportObjects(items));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Alunos");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Uma única base PDF para a lista nominal de turmas e a lista filtrada de alunos. */
export async function renderAlunosPdf(
  items: AlunoListItem[],
  context: AlunosPdfInstitutionalContext
): Promise<Buffer> {
  // As colunas específicas do relatório de Alunos cabem no A4 horizontal
  // (área útil: 841,89 - 64 = 777,89 pt). Nunca truncar nomes.
  const columns = [
    { key: "numero", label: "Nº", width: 26 },
    { key: "processo", label: "Login/Proc.", width: 80 },
    { key: "nome", label: "Nome completo", width: 166 },
    { key: "responsavel", label: "Responsável", width: 118 },
    { key: "telefone", label: "Telefone", width: 78 },
    { key: "estado", label: "Estado", width: 62 },
    { key: "turma", label: "Turma", width: 88 },
    { key: "classe", label: "Classe", width: 70 },
    { key: "turno", label: "Turno", width: 52 },
    { key: "bolsa", label: "Bolsa", width: 36 },
  ] as const;

  const rows: NominalA4Row[] = items.map((row) => ({
    numero: "",
    processo: row.numero_processo_login || row.numero_processo || "—",
    nome: row.nome || "—",
    responsavel: row.responsavel || "—",
    telefone: row.telefone_responsavel || "—",
    estado: row.status_matricula || row.status || "—",
    turma: row.turma_nome || "—",
    classe: row.classe_nome || "—",
    turno: valueFor(row, "turno") || "—",
    bolsa: valueFor(row, "bolsa_integral") || "—",
  }));

  const pdf = await renderNominalA4({
    escola: context.escola,
    turma: "Todas",
    anoLetivo: context.anoLetivo,
    modo: "Listagem filtrada",
    titulo: "LISTA DE ALUNOS",
    contexto: context.filtros,
    alunos: rows,
    colunas: columns,
    excluidos: "0",
    emissor: context.emissor,
    logoBytes: context.logoBytes,
    camposSensiveis: true,
    vazio: "Nenhum aluno corresponde aos filtros selecionados",
  });

  return Buffer.from(pdf);
}

export async function renderAlunosExport(
  items: AlunoListItem[],
  format: ExportFormat,
  pdfContext?: AlunosPdfInstitutionalContext
) {
  if (format === "pdf") {
    if (!pdfContext) throw new Error("A identificação institucional é obrigatória no PDF de alunos.");
    return {
      body: await renderAlunosPdf(items, pdfContext),
      contentType: "application/pdf",
      extension: "pdf",
    };
  }

  if (format === "csv") {
    return {
      body: renderAlunosCsv(items),
      contentType: "text/csv; charset=utf-8",
      extension: "csv",
    };
  }

  return {
    body: renderAlunosXlsx(items),
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
  };
}
