import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, StandardFonts } from 'pdf-lib'

type Maybe<T> = T | null | undefined

export interface SchoolIdentity {
  name: string
  nif?: Maybe<string>
  address?: Maybe<string>
  contacts?: Maybe<string>
  logoUrl?: Maybe<string>
  validationBaseUrl?: Maybe<string>
}

export interface DocumentTemplateOptions {
  title?: string
  school: SchoolIdentity
  verificationToken?: string
  issuedAt?: Date
  content: (ctx: DocumentContentContext) => Promise<void> | void
}

export interface DocumentContentContext {
  pdfDoc: PDFDocument
  page: PDFPage
  width: number
  height: number
  font: PDFFont
  boldFont: PDFFont
  margin: number
  contentStartY: number
  verificationUrl: string
}

async function maybeEmbedLogo(pdfDoc: PDFDocument, logoUrl?: Maybe<string>): Promise<PDFImage | null> {
  if (!logoUrl) return null
  try {
    const res = await fetch(logoUrl)
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    try {
      return await pdfDoc.embedPng(bytes)
    } catch (err) {
      // fallback for JPG
      return await pdfDoc.embedJpg(bytes)
    }
  } catch (err) {
    console.warn('[documentTemplate] falha ao carregar logo', err)
    return null
  }
}

function drawHeader(
  page: PDFPage,
  opts: {
    logo?: PDFImage | null
    school: SchoolIdentity
    font: PDFFont
    boldFont: PDFFont
    margin: number
    width: number
    height: number
    title?: string
  }
) {
  const { logo, school, font, boldFont, margin, width, height, title } = opts
  const headerTop = height - margin
  let textX = margin

  if (logo) {
    const logoHeight = 50
    const scale = logoHeight / logo.height
    const logoWidth = logo.width * scale
    page.drawImage(logo, {
      x: margin,
      y: headerTop - logoHeight,
      width: logoWidth,
      height: logoHeight,
    })
    textX = margin + logoWidth + 12
  }

  const primaryY = headerTop - 14
  page.drawText(school.name, { x: textX, y: primaryY, size: 16, font: boldFont })

  let metaLine = school.nif ? `NIF: ${school.nif}` : ''
  if (school.address) metaLine = metaLine ? `${metaLine} • ${school.address}` : school.address
  if (school.contacts) metaLine = metaLine ? `${metaLine} • ${school.contacts}` : school.contacts

  if (metaLine) {
    page.drawText(metaLine, { x: textX, y: primaryY - 16, size: 10, font })
  }

  if (title) {
    page.drawText(title, { x: margin, y: primaryY - 40, size: 14, font: boldFont })
  }

  page.drawLine({
    start: { x: margin, y: primaryY - 50 },
    end: { x: width - margin, y: primaryY - 50 },
    color: rgb(0.8, 0.8, 0.8),
    thickness: 1,
  })
}

function drawFooter(
  page: PDFPage,
  opts: { font: PDFFont; margin: number; width: number; issuedAt: Date; verificationUrl: string }
) {
  const { font, margin, width, issuedAt, verificationUrl } = opts
  const footerY = margin + 20
  const issuedLine = `Documento emitido por Moxi Nexa – ${issuedAt.toLocaleString('pt-PT')}`
  page.drawLine({
    start: { x: margin, y: footerY + 14 },
    end: { x: width - margin, y: footerY + 14 },
    color: rgb(0.8, 0.8, 0.8),
    thickness: 1,
  })
  page.drawText(issuedLine, { x: margin, y: footerY, size: 10, font })
  page.drawText(`Validar autenticidade: ${verificationUrl}`, {
    x: margin,
    y: footerY - 12,
    size: 10,
    font,
  })
}

export async function createInstitutionalPdf(options: DocumentTemplateOptions): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage()
  const { width, height } = page.getSize()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const margin = 50
  const issuedAt = options.issuedAt ?? new Date()
  const verificationBase = options.school.validationBaseUrl ?? 'https://moxinexa.com/validar'
  const verificationToken = options.verificationToken ?? 'token'
  const verificationUrl = `${verificationBase.replace(/\/$/, '')}/${verificationToken}`

  const logo = await maybeEmbedLogo(pdfDoc, options.school.logoUrl)
  drawHeader(page, {
    logo,
    school: options.school,
    font,
    boldFont,
    margin,
    width,
    height,
    title: options.title,
  })

  const contentStartY = height - 170
  await options.content({
    pdfDoc,
    page,
    width,
    height,
    font,
    boldFont,
    margin,
    contentStartY,
    verificationUrl,
  })

  drawFooter(page, { font, margin, width, issuedAt, verificationUrl })
  return pdfDoc.save()
}
