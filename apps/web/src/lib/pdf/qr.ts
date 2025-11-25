import { PDFDocument } from "pdf-lib"
import QRCode from "qrcode"
import { Buffer } from "buffer"

export async function generateQrPngBytes(url: string): Promise<Uint8Array> {
  const dataUrl = await QRCode.toDataURL(url, { margin: 0, scale: 4 })
  const base64 = dataUrl.split(",")[1]
  return Uint8Array.from(Buffer.from(base64, "base64"))
}

export async function createQrImage(pdfDoc: PDFDocument, url: string) {
  const bytes = await generateQrPngBytes(url)
  return pdfDoc.embedPng(bytes)
}

export function buildSignatureLine(opts?: { signerName?: string; signerRole?: string }) {
  const signerName = opts?.signerName?.trim() || "Direção"
  const signerRole = opts?.signerRole?.trim() || "Diretor(a)"
  return `Assinatura digital: ${signerName} – ${signerRole}`
}
