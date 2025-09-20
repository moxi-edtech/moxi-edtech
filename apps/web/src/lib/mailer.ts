// apps/web/src/lib/mailer.ts
// Lightweight mail sender with optional Resend integration.

import { getBranding } from './branding'

type SendArgs = {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendMail({ to, subject, html, text }: SendArgs): Promise<{ ok: true } | { ok: false; error: string }> {
  // Prefer SMTP when configured
  const smtp = getSmtpConfig()
  if (smtp) {
    const sent = await sendViaSmtp({ to, subject, html, text }, smtp)
    if (sent.ok) return sent
    // fall back to Resend if available
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  if (apiKey && from) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], subject, html, text }),
      })
      if (!res.ok) {
        const msg = await safeText(res)
        return { ok: false, error: `Resend HTTP ${res.status}: ${msg}` }
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  return { ok: false, error: 'No email provider configured (set SMTP_* or RESEND_* vars).' }
}

async function safeText(res: Response) {
  try { return await res.text() } catch { return '' }
}

export function buildOnboardingEmail(args: { escolaNome: string; onboardingUrl: string; adminEmail: string; adminNome?: string; plano?: string | null | undefined }) {
  const { escolaNome, onboardingUrl, adminEmail, adminNome, plano } = args
  const brand = getBranding()
  const subject = `Bem-vindo ao ${brand.name}${plano ? ` • Plano ${plano}` : ''} • Inicie o onboarding da escola`;
  const text = [
    adminNome ? `Olá, ${adminNome}.` : `Olá,`,
    ``,
    `Sua escola "${escolaNome}" foi criada no ${brand.name}.`,
    plano ? `Plano: ${plano}.` : '',
    `Para iniciar o onboarding, acesse o link abaixo:`,
    onboardingUrl,
    ``,
    `Se preferir, copie e cole o link no navegador.`,
  ].filter(Boolean).join('\n')

  const html = `
  <div style="font-family: Inter,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif; line-height:1.6; color:#0f172a;">
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
      ${brand.logoUrl ? `<img src="${brand.logoUrl}" alt="${escapeHtml(brand.name)}" style="height:28px;" />` : ''}
      <span style="font-size:18px; font-weight:700;">${escapeHtml(brand.name)}</span>
    </div>
    <h2 style="margin:0 0 12px 0; font-size:20px;">Bem-vindo!</h2>
    ${adminNome ? `<p style="margin:0 0 8px 0;">Olá, <strong>${escapeHtml(adminNome)}</strong>.</p>` : ''}
    <p style="margin:0 0 8px 0;">Sua escola <strong>${escapeHtml(escolaNome)}</strong> foi criada no <strong>${escapeHtml(brand.name)}</strong>.</p>
    ${plano ? `<p style="margin:0 0 8px 0; color:#475569;">Plano: <strong>${escapeHtml(String(plano))}</strong></p>` : ''}
    <p style="margin:0 0 20px 0;">Clique no botão abaixo para iniciar o onboarding:</p>
    <p>
      <a href="${onboardingUrl}" style="display:inline-block; background:${brand.primaryColor}; color:#fff; text-decoration:none; padding:10px 16px; border-radius:8px; font-weight:600;">Iniciar Onboarding</a>
    </p>
    <p style="margin:24px 0 8px 0; font-size:14px; color:#475569;">Se o botão não funcionar, copie e cole este link no navegador:</p>
    <p style="margin:0; font-size:13px; color:#334155; word-break:break-all;">
      <a href="${onboardingUrl}">${onboardingUrl}</a>
    </p>
    <hr style="margin:24px 0; border:0; border-top:1px solid #e2e8f0;" />
    <p style="margin:0; font-size:12px; color:#64748b;">Este e-mail foi enviado para ${escapeHtml(adminEmail)}.</p>
    ${brand.supportEmail ? `<p style="margin:8px 0 0 0; font-size:12px; color:#64748b;">Suporte: <a href="mailto:${escapeHtml(brand.supportEmail)}">${escapeHtml(brand.supportEmail)}</a></p>` : ''}
  </div>
  `
  return { subject, html, text }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

export function buildBillingEmail(args: { escolaNome: string; destinatarioEmail: string; destinatarioNome?: string; boletoUrl?: string | null; dashboardUrl?: string | null; valor?: string | null; vencimento?: string | null }) {
  const { escolaNome, destinatarioEmail, destinatarioNome, boletoUrl, dashboardUrl, valor, vencimento } = args
  const brand = getBranding()
  const subject = `Cobrança ${brand.name}${valor ? ` • ${valor}` : ''}${vencimento ? ` • vence ${vencimento}` : ''}`
  const actionUrl = boletoUrl || dashboardUrl || null
  const text = [
    destinatarioNome ? `Olá, ${destinatarioNome}.` : `Olá,`,
    ``,
    `Segue a cobrança referente à escola "${escolaNome}" no ${brand.name}.`,
    valor ? `Valor: ${valor}.` : '',
    vencimento ? `Vencimento: ${vencimento}.` : '',
    actionUrl ? `Acesse o link para visualizar/baixar: ${actionUrl}` : '',
    dashboardUrl && !boletoUrl ? `Você também pode acessar o painel financeiro: ${dashboardUrl}` : '',
  ].filter(Boolean).join('\n')

  const html = `
  <div style="font-family: Inter,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif; line-height:1.6; color:#0f172a;">
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
      ${brand.logoUrl ? `<img src="${brand.logoUrl}" alt="${escapeHtml(brand.name)}" style="height:28px;" />` : ''}
      <span style="font-size:18px; font-weight:700;">${escapeHtml(brand.name)}</span>
    </div>
    <h2 style="margin:0 0 12px 0; font-size:20px;">Cobrança</h2>
    ${destinatarioNome ? `<p style=\"margin:0 0 8px 0;\">Olá, <strong>${escapeHtml(destinatarioNome)}</strong>.</p>` : ''}
    <p style="margin:0 0 8px 0;">Segue a cobrança referente à escola <strong>${escapeHtml(escolaNome)}</strong>.</p>
    ${valor ? `<p style=\"margin:0 0 8px 0; color:#475569;\">Valor: <strong>${escapeHtml(valor)}</strong></p>` : ''}
    ${vencimento ? `<p style=\"margin:0 0 8px 0; color:#475569;\">Vencimento: <strong>${escapeHtml(vencimento)}</strong></p>` : ''}
    ${actionUrl ? `<p style=\"margin:0 0 16px 0;\"><a href=\"${actionUrl}\" style=\"display:inline-block; background:${brand.primaryColor}; color:#fff; text-decoration:none; padding:10px 16px; border-radius:8px; font-weight:600;\">Visualizar Cobrança</a></p>` : ''}
    ${dashboardUrl && !boletoUrl ? `<p style=\"margin:8px 0 0 0; font-size:14px; color:#475569;\">Ou acesse o painel financeiro: <a href=\"${dashboardUrl}\">${dashboardUrl}</a></p>` : ''}
    <hr style="margin:24px 0; border:0; border-top:1px solid #e2e8f0;" />
    <p style="margin:0; font-size:12px; color:#64748b;">Este e-mail foi enviado para ${escapeHtml(destinatarioEmail)}.</p>
    ${brand.supportEmail ? `<p style=\"margin:8px 0 0 0; font-size:12px; color:#64748b;\">Suporte: <a href=\"mailto:${escapeHtml(brand.supportEmail)}\">${escapeHtml(brand.supportEmail)}</a></p>` : ''}
  </div>
  `
  return { subject, html, text }
}

// SMTP support (optional)
type SmtpConfig = {
  host: string
  port: number
  secure: boolean
  user?: string
  pass?: string
  from: string
  dkim?: { domainName: string; keySelector: string; privateKey: string }
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true'
  const from = process.env.SMTP_FROM
  if (!host || !port || !from) return null
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const dkimDomain = process.env.SMTP_DKIM_DOMAIN
  const dkimSelector = process.env.SMTP_DKIM_SELECTOR
  const dkimKey = process.env.SMTP_DKIM_KEY
  const dkim = dkimDomain && dkimSelector && dkimKey ? { domainName: dkimDomain, keySelector: dkimSelector, privateKey: dkimKey } : undefined
  return { host, port, secure, user, pass, from, dkim }
}

async function sendViaSmtp({ to, subject, html, text }: SendArgs, cfg: SmtpConfig): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    // Dynamic require to avoid bundling issues when nodemailer isn't installed
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const req: any = (Function('return require') as any)()
    const nodemailer = req('nodemailer')
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
      dkim: cfg.dkim,
    })
    await transporter.sendMail({ from: cfg.from, to, subject, html, text })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
