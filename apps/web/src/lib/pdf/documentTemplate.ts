import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

type SchoolInfo = {
  name: string
  nif?: string | null
  address?: string | null
  contacts?: string | null
  logoUrl?: string | null
  validationBaseUrl?: string | null
}

type ContentContext = {
  page: any
  pdfDoc: PDFDocument
  width: number
  height: number
  margin: number
  contentStartY: number
  font: any
  boldFont: any
  verificationUrl?: string
}

type CreateInstitutionalPdfOptions = {
  title: string
  school: SchoolInfo
  verificationToken?: string
  content: (ctx: ContentContext) => Promise<void> | void
}

export async function createInstitutionalPdf(
  options: CreateInstitutionalPdfOptions
): Promise<Uint8Array> {
  const { title, school, verificationToken, content } = options

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage()
  const { width, height } = page.getSize()

  const margin = 50
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let cursorY = height - margin

  // Cabeçalho – nome da escola
  page.drawText(school.name ?? "Escola", {
    x: margin,
    y: cursorY,
    font: boldFont,
    size: 16,
    color: rgb(0, 0, 0.2),
  })
  cursorY -= 18

  // NIF / endereço / contactos
  const metaLines: string[] = []
  if (school.nif) metaLines.push(`NIF: ${school.nif}`)
  if (school.address) metaLines.push(school.address)
  if (school.contacts) metaLines.push(school.contacts)

  if (metaLines.length) {
    page.drawText(metaLines.join(" • "), {
      x: margin,
      y: cursorY,
      font,
      size: 9,
      color: rgb(0.3, 0.3, 0.3),
    })
    cursorY -= 18
  }

  cursorY -= 8

  // Título do documento
  page.drawText(title, {
    x: margin,
    y: cursorY,
    font: boldFont,
    size: 14,
  })
  cursorY -= 24

  // URL de verificação (se existir)
  let verificationUrl: string | undefined
  if (school.validationBaseUrl && verificationToken) {
    const base = school.validationBaseUrl.replace(/\/+$/, "")
    verificationUrl = `${base}/documentos/${verificationToken}`
    page.drawText(`Validação online: ${verificationUrl}`, {
      x: margin,
      y: cursorY,
      font,
      size: 9,
      color: rgb(0.2, 0.2, 0.5),
    })
    cursorY -= 16
  }

  const contentStartY = cursorY - 10

  // Área de conteúdo customizada
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
  })

  // Rodapé
  const footerText = `Documento emitido via Moxi Nexa • ${new Date().toLocaleString("pt-AO")}`
  page.drawText(footerText, {
    x: margin,
    y: margin - 10,
    font,
    size: 8,
    color: rgb(0.5, 0.5, 0.5),
  })

  const pdfBytes = await pdfDoc.save()
  return pdfBytes
}
