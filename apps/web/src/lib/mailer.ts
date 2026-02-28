// apps/web/src/lib/mailer.ts
// Single source of truth for outbound email (Resend).

import { createElement } from 'react'
import { render } from '@react-email/render'
import { Resend } from 'resend'
import { getBranding } from './branding'
import { KlasseWelcomeEmail } from '@/emails/KlasseWelcomeEmail'
import { BillingRenewalEmail } from '@/emails/BillingRenewalEmail'

type SendArgs = {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendMail({ to, subject, html, text }: SendArgs): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = getResendConfig()
  if (!config) {
    return { ok: false, error: 'Resend not configured (set RESEND_API_KEY).' }
  }

  try {
    const resend = getResendClient(config.apiKey)
    const payloadText = text || htmlToText(html)
    const { error } = await resend.emails.send({
      from: config.from,
      to: [to],
      subject,
      html,
      text: payloadText,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function buildOnboardingEmail(args: { escolaNome: string; onboardingUrl: string; adminEmail: string; adminNome?: string; plano?: string | null | undefined }) {
  const { onboardingUrl, adminNome, plano } = args
  const brand = getBranding()
  const subject = `Bem-vindo ao ${brand.name}${plano ? ` • Plano ${plano}` : ''} • Inicie o onboarding da escola`
  const element = createElement(KlasseWelcomeEmail, {
    nomeUsuario: adminNome || 'Gestor',
    linkAcesso: onboardingUrl,
  })
  const html = render(element)
  const text = render(element, { plainText: true })
  return { subject, html, text }
}

export async function buildBillingRenewalEmail(args: { 
  escolaNome: string; 
  plano: string; 
  valor: string; 
  dataRenovacao: string; 
  diasRestantes: number; 
  referencia: string; 
  linkPagamento: string;
}) {
  const brand = getBranding()
  const subject = args.diasRestantes === 1 
    ? `⚠️ Último dia de subscrição ${brand.name} • ${args.escolaNome}` 
    : `Aviso de renovação ${brand.name} • ${args.diasRestantes} dias restantes`;

  const element = createElement(BillingRenewalEmail, args)
  const html = await render(element)
  const text = await render(element, { plainText: true })
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

export function buildCredentialsEmail(args: { nome?: string | null; email: string; numero_login?: string | null; senha_temp?: string | null; escolaNome?: string | null; loginUrl?: string | null }) {
  const { nome, email, numero_login, senha_temp, escolaNome, loginUrl } = args
  const brand = getBranding()
  const subject = `${brand.name} • Seus dados de acesso${escolaNome ? ` • ${escolaNome}` : ''}`
  const text = [
    nome ? `Olá, ${nome}.` : `Olá,`,
    `Suas credenciais foram configuradas no ${brand.name}${escolaNome ? ` para a escola "${escolaNome}"` : ''}.`,
    numero_login ? `Número de login: ${numero_login}` : '',
    senha_temp ? `Senha temporária: ${senha_temp}` : '',
    loginUrl ? `Acesse: ${loginUrl}` : '',
    senha_temp ? `Por segurança, altere sua senha após o primeiro acesso.` : '',
  ].filter(Boolean).join('\n')

  const html = `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif; line-height:1.6; color:#0f172a;">
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
      ${brand.logoUrl ? `<img src="${brand.logoUrl}" alt="${escapeHtml(brand.name)}" style="height:28px;" />` : ''}
      <span style="font-size:18px; font-weight:700;">${escapeHtml(brand.name)}</span>
    </div>
    <h2 style="margin:0 0 12px 0; font-size:20px;">Seus dados de acesso</h2>
    ${nome ? `<p style=\"margin:0 0 8px 0;\">Olá, <strong>${escapeHtml(nome)}</strong>.</p>` : ''}
    <p style="margin:0 0 8px 0;">Suas credenciais foram configuradas${escolaNome ? ` para a escola <strong>${escapeHtml(escolaNome)}</strong>` : ''}.</p>
    ${numero_login ? `<p style=\"margin:0 0 8px 0;\">Número de login: <strong>${escapeHtml(numero_login)}</strong></p>` : ''}
    ${senha_temp ? `<p style=\"margin:0 0 8px 0;\">Senha temporária: <strong>${escapeHtml(senha_temp)}</strong></p>` : ''}
    ${loginUrl ? `<p style=\"margin:0 0 8px 0;\"><a href=\"${loginUrl}\" style=\"display:inline-block; background:${brand.primaryColor}; color:#fff; text-decoration:none; padding:10px 16px; border-radius:8px; font-weight:600;\">Acessar o sistema</a></p>` : ''}
    ${senha_temp ? `<p style=\"margin:16px 0 0 0; font-size:13px; color:#334155;\">Por segurança, altere sua senha após o primeiro acesso.</p>` : ''}
    <p style="margin:24px 0 8px 0; font-size:12px; color:#64748b;">Este e-mail foi enviado para ${escapeHtml(email)}.</p>
    ${brand.supportEmail ? `<p style=\"margin:8px 0 0 0; font-size:12px; color:#64748b;\">Suporte: <a href=\"mailto:${escapeHtml(brand.supportEmail)}\">${escapeHtml(brand.supportEmail)}</a></p>` : ''}
  </div>
  `
  return { subject, html, text }
}
type ResendConfig = {
  apiKey: string
  from: string
}

let resendClient: Resend | null = null

function getResendConfig(): ResendConfig | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  const from = process.env.RESEND_FROM_EMAIL || 'Klasse <suporte@klasse.ao>'
  return { apiKey, from }
}

function getResendClient(apiKey: string) {
  if (!resendClient) {
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

function htmlToText(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}
