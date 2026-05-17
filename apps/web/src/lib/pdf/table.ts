import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";

export interface Column {
  header: string;
  key: string;
  width: number;
  align?: "left" | "center" | "right";
}

export interface TableOptions {
  page: PDFPage;
  pdfDoc: PDFDocument;
  font: PDFFont;
  boldFont: PDFFont;
  margin: number;
  startY: number;
  rowHeight?: number;
  fontSize?: number;
  headerFontSize?: number;
  zebra?: boolean;
}

export async function drawTable(
  columns: Column[],
  data: any[],
  options: TableOptions
) {
  const {
    pdfDoc,
    font,
    boldFont,
    margin,
    rowHeight = 20,
    fontSize = 9,
    headerFontSize = 10,
    zebra = true,
  } = options;

  let currentPage = options.page;
  let cursorY = options.startY;
  const width = currentPage.getWidth();

  const drawHeader = (page: PDFPage, y: number) => {
    let currentX = margin;
    
    // Draw background for header
    page.drawRectangle({
      x: margin,
      y: y - rowHeight + 2,
      width: width - 2 * margin,
      height: rowHeight,
      color: rgb(0.1, 0.1, 0.1),
    });

    for (const col of columns) {
      let x = currentX;
      if (col.align === "center") {
        x += col.width / 2;
      } else if (col.align === "right") {
        x += col.width;
      }

      page.drawText(col.header, {
        x: col.align === "center" ? x - boldFont.widthOfTextAtSize(col.header, headerFontSize) / 2 : x,
        y: y - (rowHeight / 2) + (headerFontSize / 4),
        size: headerFontSize,
        font: boldFont,
        color: rgb(1, 1, 1),
      });
      currentX += col.width;
    }
  };

  const drawRow = (page: PDFPage, y: number, item: any, index: number) => {
    let currentX = margin;

    if (zebra && index % 2 === 1) {
      page.drawRectangle({
        x: margin,
        y: y - rowHeight + 2,
        width: width - 2 * margin,
        height: rowHeight,
        color: rgb(0.95, 0.95, 0.95),
      });
    }

    // Draw bottom border
    page.drawLine({
      start: { x: margin, y: y - rowHeight + 2 },
      end: { x: width - margin, y: y - rowHeight + 2 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });

    for (const col of columns) {
      const text = String(item[col.key] ?? "");
      let x = currentX;
      
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      let drawX = x;
      if (col.align === "center") {
        drawX = x + (col.width / 2) - (textWidth / 2);
      } else if (col.align === "right") {
        drawX = x + col.width - textWidth - 5;
      } else {
        drawX = x + 5; // padding
      }

      page.drawText(text, {
        x: drawX,
        y: y - (rowHeight / 2) + (fontSize / 4),
        size: fontSize,
        font: font,
        color: rgb(0, 0, 0),
      });
      currentX += col.width;
    }
  };

  // Initial Header
  drawHeader(currentPage, cursorY);
  cursorY -= rowHeight;

  for (let i = 0; i < data.length; i++) {
    if (cursorY < margin + 60) {
      currentPage = pdfDoc.addPage(currentPage.getSize() as any);
      cursorY = currentPage.getHeight() - margin - 20;
      drawHeader(currentPage, cursorY);
      cursorY -= rowHeight;
    }

    drawRow(currentPage, cursorY, data[i], i);
    cursorY -= rowHeight;
  }

  return { lastPage: currentPage, lastY: cursorY };
}
