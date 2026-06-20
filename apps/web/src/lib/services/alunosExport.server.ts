import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";
import type { AlunoListItem } from "@/lib/schemas/aluno.schema";

const EXPORT_HEADERS = [
  { key: "nome", label: "Nome" },
  { key: "email", label: "Email" },
  { key: "responsavel", label: "Responsavel" },
  { key: "telefone_responsavel", label: "Telefone" },
  { key: "status", label: "Status" },
  { key: "turma_nome", label: "Turma" },
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

function pdfText(value: string) {
  return value.replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "?");
}

export async function renderAlunosPdf(items: AlunoListItem[], title = "Lista de alunos") {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([842, 595]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const margin = 32;
  const rowHeight = 18;
  const columns = [
    { label: "Nome", key: "nome", x: 32, width: 200 },
    { label: "Responsavel", key: "responsavel", x: 238, width: 150 },
    { label: "Telefone", key: "telefone_responsavel", x: 394, width: 95 },
    { label: "Status", key: "status", x: 495, width: 70 },
    { label: "Turma", key: "turma_nome", x: 570, width: 115 },
    { label: "Login", key: "numero_processo_login", x: 690, width: 105 },
  ] as const;

  const drawHeader = () => {
    page.drawText(pdfText(title), { x: margin, y: 560, size: 16, font: bold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(`Total: ${items.length}`, { x: 720, y: 562, size: 9, font, color: rgb(0.25, 0.25, 0.25) });
    for (const column of columns) {
      page.drawText(column.label, { x: column.x, y: 532, size: 8, font: bold, color: rgb(0.15, 0.15, 0.15) });
    }
    page.drawLine({ start: { x: margin, y: 524 }, end: { x: 810, y: 524 }, thickness: 0.8, color: rgb(0.75, 0.75, 0.75) });
  };

  drawHeader();
  let y = 506;

  for (const row of items) {
    if (y < 40) {
      page = pdfDoc.addPage([842, 595]);
      drawHeader();
      y = 506;
    }

    for (const column of columns) {
      const raw = valueFor(row, column.key);
      const maxChars = Math.max(8, Math.floor(column.width / 4.5));
      const text = raw.length > maxChars ? `${raw.slice(0, maxChars - 1)}...` : raw;
      page.drawText(pdfText(text), { x: column.x, y, size: 7.5, font, color: rgb(0.08, 0.08, 0.08) });
    }
    y -= rowHeight;
  }

  return Buffer.from(await pdfDoc.save());
}

export async function renderAlunosExport(items: AlunoListItem[], format: ExportFormat) {
  if (format === "pdf") {
    return {
      body: await renderAlunosPdf(items),
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
