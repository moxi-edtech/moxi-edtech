import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/** PDF nominal isolado. Nunca incluir nomes de alunos nos metadados. */
export type NominalA4Row = {
  numero: string;
  processo: string;
  nome: string;
  turma: string;
  estado: string;
  nascimento?: string;
  naturalidade?: string;
  bi?: string;
};
export type NominalA4Options = {
  escola: string;
  turma: string;
  anoLetivo: string;
  modo: string;
  alunos: readonly NominalA4Row[];
  excluidos: string;
  emissor: string;
  emitidoEm?: Date;
  camposSensiveis?: boolean;
  logoBytes?: Uint8Array;
  qrImageBytes?: Uint8Array;
};

type CellColumn = { key: keyof NominalA4Row; label: string; width: number };
type PreparedRow = { columns: string[][]; height: number };

/** O Nº impresso é a posição na lista exportada, não o número de chamada guardado. */
export function numberNominalA4Rows(rows: readonly NominalA4Row[]): NominalA4Row[] {
  return rows.map((row, index) => ({ ...row, numero: String(index + 1) }));
}

const A4_PORTRAIT: [number, number] = [595.28, 841.89];
const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const MARGIN = 32;
const FOOTER_BOTTOM = 26;
const TEXT_SIZE = 9;
const ROW_LINE_HEIGHT = 11;

/** WinAnsi preserva os acentos do português. Outros símbolos têm fallback legível. */
function printable(text: string, font: PDFFont): string {
  return Array.from(text).map((glyph) => {
    try {
      font.widthOfTextAtSize(glyph, TEXT_SIZE);
      return glyph;
    } catch {
      const folded = glyph.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
      const mapped = Array.from(folded).filter((c) => {
        try { font.widthOfTextAtSize(c, TEXT_SIZE); return true; } catch { return false; }
      }).join("");
      return mapped || "?";
    }
  }).join("");
}

function wrap(text: string, width: number, font: PDFFont, size = TEXT_SIZE): string[] {
  const content = printable(text || "—", font);
  const max = Math.max(1, width - 9);
  const lines: string[] = [];
  let current = "";
  for (const word of content.split(/\s+/).filter(Boolean)) {
    const joined = current ? current + " " + word : word;
    if (font.widthOfTextAtSize(joined, size) <= max) {
      current = joined;
      continue;
    }
    if (current) lines.push(current);
    current = "";
    for (const c of Array.from(word)) {
      if (current && font.widthOfTextAtSize(current + c, size) > max) {
        lines.push(current);
        current = "";
      }
      current += c;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["—"];
}

function drawFit(
  page: PDFPage, value: string, x: number, top: number, width: number,
  font: PDFFont, size: number, lineHeight: number, maxLines = 10
): number {
  const lines = wrap(value, width, font, size).slice(0, maxLines);
  for (let i = 0; i < lines.length; i++) {
    page.drawText(lines[i], { x, y: top - (i * lineHeight), font, size, color: rgb(0.13, 0.17, 0.23) });
  }
  return lines.length;
}

/**
 * Uma única lista por turma/classe. Os blocos do cabeçalho são redesenhados
 * em cada página, e a assinatura/QR são indivisíveis.
 */
export async function renderNominalA4(options: NominalA4Options): Promise<Uint8Array> {
  const {
    escola, turma, anoLetivo, modo, alunos, excluidos, emissor,
    emitidoEm = new Date(), camposSensiveis = false, logoBytes, qrImageBytes,
  } = options;

  const doc = await PDFDocument.create();
  doc.setTitle("Lista nominal de alunos");
  doc.setAuthor("KLASSE");
  doc.setProducer("KLASSE");
  doc.setSubject("Lista académica de alunos");
  doc.setKeywords(["lista nominal", "educação", "escola"]);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const [pageW, pageH] = camposSensiveis ? A4_LANDSCAPE : A4_PORTRAIT;
  const available = pageW - 2 * MARGIN;
  const cols: CellColumn[] = camposSensiveis
    ? [
        { key: "numero", label: "Nº", width: 26 },
        { key: "processo", label: "Processo", width: 70 },
        { key: "nome", label: "Nome completo", width: 250 },
        { key: "turma", label: "Turma", width: 78 },
        { key: "estado", label: "Situação", width: 63 },
        { key: "nascimento", label: "Nascimento", width: 72 },
        { key: "naturalidade", label: "Naturalidade", width: 92 },
        { key: "bi", label: "BI", width: 98 },
      ]
    : [
        { key: "numero", label: "Nº", width: 27 },
        { key: "processo", label: "Processo", width: 78 },
        { key: "nome", label: "Nome completo", width: 254 },
        { key: "turma", label: "Turma", width: 103 },
        { key: "estado", label: "Situação", width: 69 },
      ];
  const used = cols.reduce((sum, col) => sum + col.width, 0);
  if (used > available) throw new Error("Largura da pauta ultrapassa a área útil do A4");

  const dateLabel = new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Africa/Luanda", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(emitidoEm);

  let embeddedLogo: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  if (logoBytes?.length) {
    try {
      embeddedLogo = logoBytes[0] === 0x89
        ? await doc.embedPng(logoBytes)
        : await doc.embedJpg(logoBytes);
    } catch { /* Logo indisponível: impressão continua sem perda de dados. */ }
  }

  const openPage = (): { page: PDFPage; y: number } => {
    const page = doc.addPage([pageW, pageH]);
    // Cabeçalho institucional: logótipo e nome partilham o mesmo centro vertical.
    // Reservar a altura efetiva do nome (sem truncar escolas com nomes extensos)
    // e manter sempre uma folga antes da linha divisória.
    const headerTop = pageH - MARGIN;
    const logoBox = 42;
    const schoolFontSize = 12;
    const schoolLineHeight = 15;
    const left = embeddedLogo ? MARGIN + 50 : MARGIN;
    const headingWidth = available - (embeddedLogo ? 50 : 0);
    const schoolLines = wrap(escola, headingWidth, bold, schoolFontSize);
    const schoolHeight = schoolFontSize + (schoolLines.length - 1) * schoolLineHeight;
    const headerHeight = Math.max(embeddedLogo ? 46 : 30, schoolHeight + 12);

    if (embeddedLogo) {
      const size = embeddedLogo.scaleToFit(logoBox, logoBox);
      page.drawImage(embeddedLogo, {
        x: MARGIN + (logoBox - size.width) / 2,
        y: headerTop - (headerHeight + size.height) / 2,
        width: size.width,
        height: size.height,
      });
    }

    const firstBaseline = headerTop - (headerHeight - schoolHeight) / 2 - schoolFontSize;
    schoolLines.forEach((line, index) => {
      page.drawText(line, {
        x: left, y: firstBaseline - index * schoolLineHeight,
        font: bold, size: schoolFontSize, color: rgb(0.13, 0.17, 0.23),
      });
    });
    let y = headerTop - headerHeight - 9;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: pageW - MARGIN, y }, thickness: 0.9, color: rgb(0.84, 0.86, 0.89) });
    y -= 22;
    page.drawText("LISTA NOMINAL DE ALUNOS", { x: MARGIN, y, font: bold, size: 13, color: rgb(0.13, 0.17, 0.23) });
    y -= 19;
    y -= drawFit(page, "Turma: " + turma + "  |  Ano letivo: " + anoLetivo, MARGIN, y, available, bold, 9, 12) * 12;
    y -= drawFit(page, "Modo: " + modo, MARGIN, y, available, font, 9, 12) * 12;
    y -= drawFit(page, "Alunos: " + alunos.length + "  |  Excluídos: " + excluidos, MARGIN, y, available, font, 8, 11) * 11;
    if (camposSensiveis) {
      page.drawText("INFORMAÇÃO SENSÍVEL - USO AUTORIZADO", { x: MARGIN, y, font: bold, size: 8, color: rgb(0.62, 0.25, 0.17) });
      y -= 12;
    }
    y -= 10;
    page.drawRectangle({ x: MARGIN, y: y - 19, width: used, height: 19, color: rgb(0.12, 0.17, 0.24) });
    let x = MARGIN;
    for (const col of cols) {
      page.drawText(col.label, { x: x + 4, y: y - 12, size: 7.7, font: bold, color: rgb(1, 1, 1) });
      x += col.width;
    }
    y -= 21;
    return { page, y };
  };

  const prepared: PreparedRow[] = numberNominalA4Rows(alunos).map((row) => {
    const lines = cols.map((col) => wrap(String(row[col.key] ?? "—"), col.width, font));
    return {
      columns: lines,
      height: Math.max(22, 8 + Math.max(...lines.map((x) => x.length)) * ROW_LINE_HEIGHT),
    };
  });

  let { page, y } = openPage();

  if (prepared.length === 0) {
    y -= 25;
    page.drawText("Sem alunos matriculados neste período", { x: MARGIN + 8, y, font: bold, size: 11 });
  }

  for (let rowIdx = 0; rowIdx < prepared.length; rowIdx++) {
    const row = prepared[rowIdx];
    if (y - row.height < FOOTER_BOTTOM + 35) {
      ({ page, y } = openPage());
    }
    if (rowIdx % 2 === 1) {
      page.drawRectangle({ x: MARGIN, y: y - row.height + 1, width: used, height: row.height, color: rgb(0.96, 0.97, 0.98) });
    }
    let x = MARGIN;
    for (let i = 0; i < cols.length; i++) {
      for (let line = 0; line < row.columns[i].length; line++) {
        page.drawText(row.columns[i][line], {
          x: x + 4, y: y - 12 - line * ROW_LINE_HEIGHT,
          font, size: TEXT_SIZE, color: rgb(0.16, 0.20, 0.26),
        });
      }
      x += cols[i].width;
    }
    y -= row.height;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + used, y }, thickness: 0.3, color: rgb(0.81, 0.84, 0.87) });
  }

  // Reservar o bloco indivisível antes de o desenhar (incluindo QR).
  const signatureHeight = qrImageBytes?.length ? 114 : 77;
  if (y - signatureHeight < FOOTER_BOTTOM + 30) {
    ({ page, y } = openPage());
  }
  y -= 18;
  page.drawText("Total de alunos: " + alunos.length, { x: MARGIN + 4, y, font: bold, size: 10 });
  y -= 34;
  page.drawLine({ start: { x: MARGIN + 4, y }, end: { x: MARGIN + 195, y }, thickness: 0.8, color: rgb(0.18, 0.24, 0.29) });
  y -= 14;
  page.drawText("Assinatura da Direcção", { x: MARGIN + 4, y, font, size: 9 });
  if (qrImageBytes?.length) {
    try {
      const qr = await doc.embedPng(qrImageBytes);
      const qrSize = 74;
      page.drawImage(qr, { x: pageW - MARGIN - qrSize, y: y - 11, width: qrSize, height: qrSize });
      page.drawText("Verificação digital", {
        x: pageW - MARGIN - qrSize - 6, y: y - 20, font, size: 8,
      });
    } catch { /* QR não pode invalidar a lista nominal. */ }
  }

  const pages = doc.getPages();
  pages.forEach((p, idx) => {
    p.drawLine({
      start: { x: MARGIN, y: FOOTER_BOTTOM + 24 },
      end: { x: pageW - MARGIN, y: FOOTER_BOTTOM + 24 },
      thickness: 0.5, color: rgb(0.84, 0.86, 0.89),
    });
    const left = "Emitido em " + dateLabel + "  |  Utilizador: " + printable(emissor, font);
    const safeLeft = wrap(left, available - 90, font, 7)[0] ?? "Emissão KLASSE";
    p.drawText(safeLeft, { x: MARGIN, y: FOOTER_BOTTOM + 12, font, size: 7 });
    p.drawText("Gerado pelo KLASSE | Sistema de Gestão Escolar Inteligente | www.klasse.ao", {
      x: MARGIN, y: FOOTER_BOTTOM - 1, font: bold, size: 7,
      color: rgb(0.12, 0.40, 0.23),
    });
    const label = "Página " + (idx + 1) + " de " + pages.length;
    p.drawText(label, {
      x: pageW - MARGIN - bold.widthOfTextAtSize(label, 8),
      y: FOOTER_BOTTOM + 12, font: bold, size: 8,
    });
  });
  return doc.save();
}
