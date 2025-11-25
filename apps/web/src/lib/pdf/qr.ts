import { PDFDocument } from "pdf-lib";

type SignatureLineOptions = {
  signerName?: string | null;
  signerRole?: string | null;
};

export async function createQrImage(pdfDoc: PDFDocument, url: string) {
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(url)}&margin=1&size=240`;
  const response = await fetch(qrUrl);
  if (!response.ok) {
    throw new Error(`Falha ao gerar QR code: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const imageBytes = new Uint8Array(buffer);
  return pdfDoc.embedPng(imageBytes);
}

export function buildSignatureLine({ signerName, signerRole }: SignatureLineOptions) {
  if (!signerName && !signerRole) return "Emitido digitalmente";
  if (signerName && signerRole) return `Emitido por ${signerName} (${signerRole})`;
  if (signerName) return `Emitido por ${signerName}`;
  return signerRole ?? "Emitido digitalmente";
}
