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
  const rawName = process.env.BRAND_NAME?.trim() || 'KLASSE'
  const name = /moxinexa/i.test(rawName) ? 'KLASSE' : rawName
  const primaryColor = process.env.BRAND_PRIMARY_COLOR?.trim() || '#1F6B3B'
  const logoUrl = process.env.BRAND_LOGO_URL?.trim() || null
  const supportEmail = process.env.BRAND_SUPPORT_EMAIL?.trim() || null
  const financeEmail = process.env.BRAND_FINANCE_EMAIL?.trim() || null
  const financeWhatsApp = process.env.BRAND_FINANCE_WHATSAPP?.trim() || null
  return { name, primaryColor, logoUrl, supportEmail, financeEmail, financeWhatsApp }
}
