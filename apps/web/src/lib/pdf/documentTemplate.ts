import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export type InstitutionalPdfOptions = {
  title: string;
  school: {
    name: string;
    nif?: string | null;
    address?: string | null;
    contacts?: string | null;
    logoUrl?: string | null;
    validationBaseUrl?: string | null;
  };
  verificationToken?: string;
  content: (ctx: {
    page: ReturnType<PDFDocument["addPage"]>;
    pdfDoc: PDFDocument;
    width: number;
    height: number;
    margin: number;
    contentStartY: number;
    font: PDFFont;
    boldFont: PDFFont;
    verificationUrl?: string;
  }) => Promise<void>;
};

async function fetchImageBytes(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erro ao carregar imagem: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export async function createInstitutionalPdf({
  title,
  school,
  verificationToken,
  content,
}: InstitutionalPdfOptions) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const width = page.getWidth();
  const height = page.getHeight();
  const margin = 45;
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const validationBaseUrl = school.validationBaseUrl?.replace(/\/$/, "");
  const verificationUrl =
    validationBaseUrl && verificationToken
      ? `${validationBaseUrl}/${verificationToken}`
      : undefined;

  let cursorY = height - margin;

  // Header logo
  if (school.logoUrl) {
    try {
      const logoBytes = await fetchImageBytes(school.logoUrl);
      const isPng = school.logoUrl.toLowerCase().includes(".png");
      const logoImage = isPng ? await pdfDoc.embedPng(logoBytes) : await pdfDoc.embedJpg(logoBytes);
      const scale = 90 / logoImage.height;
      const logoDims = logoImage.scale(scale);
      page.drawImage(logoImage, {
        x: margin,
        y: height - margin - logoDims.height,
        width: logoDims.width,
        height: logoDims.height,
      });
    } catch (e) {
      console.warn("Não foi possível carregar o logotipo:", e);
    }
  }

  page.drawText(school.name, {
    x: margin + 100,
    y: height - margin - 10,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  const details: string[] = [];
  if (school.nif) details.push(`NIF: ${school.nif}`);
  if (school.address) details.push(school.address);
  if (school.contacts) details.push(school.contacts);

  if (details.length > 0) {
    page.drawText(details.join(" • "), {
      x: margin + 100,
      y: height - margin - 26,
      size: 9,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
  }

  page.drawLine({
    start: { x: margin, y: height - margin - 40 },
    end: { x: width - margin, y: height - margin - 40 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  cursorY = height - margin - 60;

  page.drawText(title, {
    x: margin,
    y: cursorY,
    size: 13,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  cursorY -= 12;

  const contentStartY = cursorY - 10;

  await content({
    page,
    pdfDoc,
    width,
    height,
    margin,
    contentStartY,
    font,
    boldFont,
    verificationUrl,
  });

  const footerY = margin + 20;
  page.drawLine({
    start: { x: margin, y: footerY },
    end: { x: width - margin, y: footerY },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });

  const footerText = verificationUrl
    ? `Para verificar a autenticidade, acesse: ${verificationUrl}`
    : "Documento gerado pelo sistema académico.";

  page.drawText(footerText, {
    x: margin,
    y: footerY - 12,
    size: 8,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  return pdfDoc.save();
}
