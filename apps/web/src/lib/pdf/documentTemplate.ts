import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export type InstitutionalPdfOptions = {
  title: string;
  subtitle?: string;
  orientation?: "portrait" | "landscape";
  school: {
    name: string;
    nif?: string | null;
    address?: string | null;
    contacts?: string | null;
    logoUrl?: string | null;
    fallbackLogoUrl?: string | null;
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

// Official Brand Colors
const KLASSE_GREEN = rgb(0.1216, 0.4196, 0.2314); // #1F6B3B
const SLATE_500 = rgb(0.3922, 0.4549, 0.5451); // #64748B
const SLATE_900 = rgb(0.0588, 0.0902, 0.1647); // #0F172A

function wrapText(text: string, maxWidth: number, font: PDFFont, size: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

type FetchedImage = {
  bytes: Uint8Array;
  contentType: string | null;
};

export async function fetchImageBytes(url: string): Promise<FetchedImage> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erro ao carregar imagem: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return {
    bytes: new Uint8Array(arrayBuffer),
    contentType: response.headers.get("content-type"),
  };
}

export function detectImageFormat(bytes: Uint8Array, contentType: string | null, url: string) {
  const normalizedType = contentType?.toLowerCase() ?? "";
  if (normalizedType.includes("png")) return "png" as const;
  if (normalizedType.includes("jpeg") || normalizedType.includes("jpg")) return "jpg" as const;

  if (bytes.length >= 8) {
    const pngSignature = [0x89, 0x50, 0x4e, 0x47];
    if (pngSignature.every((byte, index) => bytes[index] === byte)) return "png" as const;
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return "jpg" as const;
  }

  const normalizedUrl = url.toLowerCase();
  if (normalizedUrl.includes(".png")) return "png" as const;
  if (normalizedUrl.includes(".jpeg") || normalizedUrl.includes(".jpg")) return "jpg" as const;

  throw new Error(`Formato de imagem não suportado: ${contentType ?? "desconhecido"}`);
}

async function embedSchoolLogo(
  pdfDoc: PDFDocument,
  school: InstitutionalPdfOptions["school"]
) {
  const candidates = [school.logoUrl, school.fallbackLogoUrl]
    .map((value) => value?.trim() || null)
    .filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);

  for (const candidate of candidates) {
    try {
      const { bytes, contentType } = await fetchImageBytes(candidate);
      const format = detectImageFormat(bytes, contentType, candidate);
      const image = format === "png" ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      return { image, sourceUrl: candidate };
    } catch (error) {
      console.warn("Não foi possível carregar o logotipo:", candidate, error);
    }
  }

  return null;
}

export async function createInstitutionalPdf({
  title,
  subtitle,
  school,
  verificationToken,
  orientation = "portrait",
  content,
}: InstitutionalPdfOptions) {
  const pdfDoc = await PDFDocument.create();
  const pageSize = orientation === "landscape" ? [841.89, 595.28] : [595.28, 841.89]; // A4
  const page = pdfDoc.addPage(pageSize as any);
  const width = page.getWidth();
  const height = page.getHeight();
  const margin = 40;
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const validationBaseUrl = school.validationBaseUrl?.replace(/\/$/, "");
  const verificationUrl =
    validationBaseUrl && verificationToken
      ? `${validationBaseUrl}/${verificationToken}`
      : undefined;

  const drawHeader = async (p: any) => {
    const embeddedLogo = await embedSchoolLogo(pdfDoc, school);
    
    // Header Row with Branding Green for the School Name
    if (embeddedLogo) {
        const scale = 50 / embeddedLogo.image.height;
        const logoDims = embeddedLogo.image.scale(scale);
        p.drawImage(embeddedLogo.image, {
          x: margin,
          y: height - margin - logoDims.height,
          width: logoDims.width,
          height: logoDims.height,
        });
    }

    const textStartX = embeddedLogo ? margin + 70 : margin;
    const textWidth = width - textStartX - margin;

    p.drawText(school.name.toUpperCase(), {
      x: textStartX,
      y: height - margin - 12,
      size: 14,
      font: boldFont,
      color: KLASSE_GREEN,
    });

    const details: string[] = [];
    if (school.nif) details.push(`NIF: ${school.nif}`);
    if (school.address) details.push(school.address);
    if (school.contacts) details.push(school.contacts);

    if (details.length > 0) {
      const detailLines = wrapText(details.join("  •  "), textWidth, font, 8).slice(0, 2);
      let detailsY = height - margin - 28;
      for (const line of detailLines) {
        p.drawText(line, {
          x: textStartX,
          y: detailsY,
          size: 8,
          font,
          color: SLATE_500,
        });
        detailsY -= 11;
      }
    }

    p.drawLine({
      start: { x: margin, y: height - margin - 57 },
      end: { x: width - margin, y: height - margin - 57 },
      thickness: 1,
      color: rgb(0.9, 0.9, 0.9),
    });
  };

  const drawFooter = (p: any) => {
    const footerY = margin + 15;
    p.drawLine({
      start: { x: margin, y: footerY },
      end: { x: width - margin, y: footerY },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9),
    });

    const footerText = verificationUrl
      ? `Autenticidade verificável via QR Code ou em: ${verificationUrl}`
      : "Documento oficial gerado pelo sistema de gestão académica.";

    p.drawText(footerText, {
      x: margin,
      y: footerY - 12,
      size: 7,
      font,
      color: SLATE_500,
    });
  };

  await drawHeader(page);
  
  let cursorY = height - margin - 92;

  // Type Label (Small caps look)
  if (subtitle) {
    page.drawText(subtitle.toUpperCase(), {
      x: margin,
      y: cursorY + 14,
      size: 8,
      font: boldFont,
      color: SLATE_500,
    });
  }

  // Document Title in Slate 900
  page.drawText(title, {
    x: margin,
    y: cursorY,
    size: 16,
    font: boldFont,
    color: SLATE_900,
  });

  cursorY -= 20;

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

  // Draw footer on all pages
  const pages = pdfDoc.getPages();
  for (const p of pages) {
    drawFooter(p);
  }

  return pdfDoc.save();
}
