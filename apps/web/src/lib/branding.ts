// apps/web/src/lib/branding.ts

export type BrandingConfig = {
  name: string
  primaryColor: string
  logoUrl?: string | null
  supportEmail?: string | null
  financeEmail?: string | null
  financeWhatsApp?: string | null
}

export function getBranding(): BrandingConfig {
  const name = process.env.BRAND_NAME?.trim() || 'MoxiNexa'
  const primaryColor = process.env.BRAND_PRIMARY_COLOR?.trim() || '#2563eb'
  const logoUrl = process.env.BRAND_LOGO_URL?.trim() || null
  const supportEmail = process.env.BRAND_SUPPORT_EMAIL?.trim() || null
  const financeEmail = process.env.BRAND_FINANCE_EMAIL?.trim() || null
  const financeWhatsApp = process.env.BRAND_FINANCE_WHATSAPP?.trim() || null
  return { name, primaryColor, logoUrl, supportEmail, financeEmail, financeWhatsApp }
}
