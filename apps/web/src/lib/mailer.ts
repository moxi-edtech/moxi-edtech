// apps/web/src/lib/mailer.ts
// Single source of truth for outbound email (Resend).

import { createElement } from 'react'
import { render } from '@react-email/render'
import { Resend } from 'resend'
import { getBranding } from './branding'
import { KlasseWelcomeEmail } from '@/emails/KlasseWelcomeEmail'
import { BillingRenewalEmail } from '@/emails/BillingRenewalEmail'
import { KlasseLifecycleReminderEmail } from '@/emails/KlasseLifecycleReminderEmail'

type SendArgs = {
  to: string
  subject: string
  html: string | Promise<string>
  text?: string | Promise<string>
}

export async function sendMail({ to, subject, html, text }: SendArgs): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = getResendConfig()
  if (!config) {
    return { ok: false, error: 'Resend not configured (set RESEND_API_KEY).' }
  }

  try {
    const resend = getResendClient(config.apiKey)
    const resolvedHtml = await Promise.resolve(html)
    const resolvedText = text ? await Promise.resolve(text) : htmlToText(resolvedHtml)
    const { error } = await resend.emails.send({
      from: config.from,
      to: [to],
      subject,
      html: resolvedHtml,
      text: resolvedText,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function buildOnboardingEmail(args: { escolaNome: string; onboardingUrl: string; adminEmail: string; adminNome?: string; plano?: string | null | undefined }) {
  const { onboardingUrl, adminNome, plano, escolaNome } = args
  const brand = getBranding()
  const subject = `Bem-vindo ao ${brand.name}${plano ? ` • Plano ${plano}` : ''} • Inicie o onboarding da escola`
  const element = createElement(KlasseWelcomeEmail, {
    nomeUsuario: adminNome || 'Gestor',
    linkAcesso: onboardingUrl,
    escolaNome,
    plano: plano ?? null,
  })
  const html = render(element)
  const text = render(element, { plainText: true })
  return { subject, html, text }
}

export function buildInviteEmail(args: {
  escolaNome: string
  onboardingUrl: string
  convidadoEmail: string
  convidadoNome?: string | null
  papel?: string | null
  tenant_type?: string | null
}) {
  const { escolaNome, onboardingUrl, convidadoEmail, convidadoNome, papel, tenant_type } = args
  const brand = getBranding()
  const isFormacao = tenant_type === 'formacao'
  const guidance = getInviteGuidance(papel, isFormacao)

  const displayBrand = isFormacao ? `${brand.name} Formação` : brand.name
  const subject = `Convite ${displayBrand} • ${escolaNome}`

  const text = [
    convidadoNome ? `Olá, ${convidadoNome}.` : 'Olá,',
    `Você foi convidado para aceder ao ${displayBrand} do centro "${escolaNome}".`,
    guidance.cargo ? `Cargo: ${guidance.cargo}.` : '',
    guidance.portal ? `Portal: ${guidance.portal}.` : '',
    guidance.tasks.length > 0 ? `Ao entrar, você deverá:` : '',
    ...guidance.tasks.map((task) => `- ${task}`),
    onboardingUrl ? `Aceitar convite: ${onboardingUrl}` : '',
  ].filter(Boolean).join('\n')

  const buttonHtml = onboardingUrl
    ? `<a href="${onboardingUrl}" style="display:inline-block; background:#E3B23C; color:#020617; text-decoration:none; padding:12px 24px; border-radius:12px; font-weight:700; font-size:14px;">Entrar no KLASSE</a>`
    : ''

  const html = `
  <div style="background-color:#f8fafc; margin:0; padding:24px 8px; font-family:Helvetica, Arial, sans-serif;">
    <div style="border:1px solid #eaeaea; border-radius:16px; margin:40px auto; padding:20px; max-width:465px; background-color:#ffffff; box-shadow:0 1px 4px rgba(15,23,42,0.08); line-height:1.6; color:#0f172a;">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px; justify-content:center;">
        ${brand.logoUrl ? `<img src="${brand.logoUrl}" alt="${escapeHtml(brand.name)}" style="height:32px;" />` : ''}
        <span style="font-size:20px; font-weight:700;">${escapeHtml(displayBrand)}</span>
      </div>
      <h2 style="margin:0 0 12px 0; font-size:22px; color:#020617; text-align:center;">Convite para ${escapeHtml(escolaNome)}</h2>
      ${convidadoNome ? `<p style="margin:0 0 8px 0;">Olá, <strong>${escapeHtml(convidadoNome)}</strong>.</p>` : '<p style="margin:0 0 8px 0;">Olá,</p>'}
      <p style="margin:0 0 8px 0; color:#475569;">Você foi convidado para operar no centro <strong>${escapeHtml(escolaNome)}</strong> através da plataforma <strong>${escapeHtml(displayBrand)}</strong>.</p>
      ${guidance.cargo ? `<p style="margin:0 0 8px 0; color:#475569;">Sua função: <strong>${escapeHtml(guidance.cargo)}</strong></p>` : ''}
      ${guidance.portal ? `<p style="margin:0 0 8px 0; color:#475569;">Acesso via: <strong>${escapeHtml(guidance.portal)}</strong></p>` : ''}
      ${guidance.tasks.length > 0 ? `
      <div style="margin:14px 0 8px 0; border:1px solid #e2e8f0; border-radius:12px; padding:12px 14px; background:#f8fafc;">
        <p style="margin:0 0 8px 0; color:#334155; font-size:13px; font-weight:700;">Seu Checklist de Onboarding</p>
        <ul style="margin:0; padding-left:18px; color:#475569; font-size:13px;">
          ${guidance.tasks.map((task) => `<li style="margin:0 0 6px 0;">${escapeHtml(task)}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      ${buttonHtml ? `<div style="text-align:center; margin:24px 0;">${buttonHtml}</div>` : ''}
      <hr style="border:0; border-top:1px solid #e2e8f0; margin:24px 0;" />
      <p style="margin:0; font-size:12px; color:#64748b;">Este e-mail foi enviado para ${escapeHtml(convidadoEmail)}.</p>
      ${brand.supportEmail ? `<p style="margin:8px 0 0 0; font-size:12px; color:#64748b;">Suporte: <a href="mailto:${escapeHtml(brand.supportEmail)}">${escapeHtml(brand.supportEmail)}</a></p>` : ''}
      <p style="margin:10px 0 0 0; font-size:12px; color:#64748b;">© 2026 Moxi Soluções. Todos os direitos reservados.</p>
    </div>
  </div>
  `
  return { subject, html, text }
}

function getInviteGuidance(papel?: string | null, isFormacao: boolean = false): { cargo: string | null; portal: string | null; tasks: string[] } {
  const role = String(papel || '').trim().toLowerCase()

  if (isFormacao) {
    const formationMap: Record<string, { cargo: string; portal: string; tasks: string[] }> = {
      formacao_admin: {
        cargo: 'Gestor do Centro',
        portal: 'Dashboard Administrativo (Formação)',
        tasks: [
          'Publicar o catálogo de cursos ativos.',
          'Abrir as primeiras turmas (cohorts) e definir vagas.',
          'Configurar a equipe inicial e permissões de acesso.',
          'Acompanhar indicadores de ocupação e margem.'
        ],
      },
      formacao_secretaria: {
        cargo: 'Operador de Secretaria',
        portal: 'Portal da Secretaria (Balcão)',
        tasks: [
          'Registar novas inscrições via balcão.',
          'Validar inscrições vindas das Landing Pages.',
          'Gerir o status dos formandos por turma.',
          'Resolver ambiguidades e duplicidades de perfis.'
        ],
      },
      formacao_financeiro: {
        cargo: 'Responsável Financeiro',
        portal: 'Dashboard Financeiro (B2B/B2C)',
        tasks: [
          'Configurar contratos e faturamento de clientes B2B.',
          'Monitorizar faturas em aberto e inadimplência.',
          'Realizar a reconciliação bancária de comprovativos.',
          'Analisar a rentabilidade (Cohort Economics).'
        ],
      },
      formador: {
        cargo: 'Formador / Consultor',
        portal: 'Portal do Formador',
        tasks: [
          'Consultar agenda de aulas e mentorias.',
          'Monitorizar o progresso e presença dos formandos.',
          'Validar honorários e lançamentos de carga horária.'
        ],
      },
    }

    const guidance = formationMap[role] || formationMap[role.replace(/^formacao_/, '')]
    if (guidance) return guidance

    return {
      cargo: papel || 'Colaborador',
      portal: 'Plataforma KLASSE Formação',
      tasks: [
        'Completar o primeiro acesso e validar seus dados.',
        'Revisar os módulos operacionais do seu painel.'
      ],
    }
  }

  // Original generic school logic
  if (!role) {
    return {
      cargo: null,
      portal: 'Portal da Escola',
      tasks: [
        'Completar o primeiro acesso e validar seus dados de perfil.',
        'Revisar os módulos disponíveis no seu painel.',
      ],
    }
  }

  const map: Record<string, { cargo: string; portal: string; tasks: string[] }> = {
    secretaria: {
      cargo: 'Secretaria',
      portal: 'Portal da Secretaria',
      tasks: [
        'Conferir e atualizar dados de alunos e encarregados.',
        'Gerir matrículas, transferências e documentação escolar.',
        'Acompanhar comunicação oficial e pendências administrativas.',
      ],
    },
    financeiro: {
      cargo: 'Financeiro',
      portal: 'Portal Financeiro',
      tasks: [
        'Revisar tabelas de preços, mensalidades e emolumentos.',
        'Acompanhar cobranças, pagamentos e recibos.',
        'Monitorar pendências financeiras e regularizações.',
      ],
    },
    admin_escola: {
      cargo: 'Administrador da Escola',
      portal: 'Portal Administrativo',
      tasks: [
        'Validar configurações acadêmicas e operacionais da escola.',
        'Revisar permissões de utilizadores e fluxos de aprovação.',
        'Acompanhar indicadores críticos do painel administrativo.',
      ],
    },
    professor: {
      cargo: 'Professor',
      portal: 'Portal do Professor',
      tasks: [
        'Conferir turmas, disciplinas e horários atribuídos.',
        'Lançar notas e frequências dentro dos prazos.',
        'Acompanhar recados e orientações pedagógicas.',
      ],
    },
  }

  const guidance = map[role]
  if (guidance) return guidance

  return {
    cargo: papel || null,
    portal: 'Portal da Escola',
    tasks: [
      'Concluir o primeiro acesso e revisar suas permissões.',
      'Validar as tarefas pendentes no seu painel inicial.',
    ],
  }
}

export function buildResetPasswordEmail(args: { resetUrl: string; expiresEm?: string | null }) {
  const { resetUrl, expiresEm } = args
  const brand = getBranding()
  const subject = `Redefinição de senha ${brand.name}`
  const text = [
    `Recebemos um pedido para redefinir sua senha no ${brand.name}.`,
    resetUrl ? `Redefinir senha: ${resetUrl}` : '',
    expiresEm ? `Este link expira em ${expiresEm}.` : '',
  ].filter(Boolean).join('\n')

  const html = `
  <div style="background-color:#f8fafc; margin:0; padding:24px 8px; font-family:Helvetica, Arial, sans-serif;">
    <div style="border:1px solid #eaeaea; border-radius:16px; margin:40px auto; padding:20px; max-width:465px; background-color:#ffffff; box-shadow:0 1px 4px rgba(15,23,42,0.08); line-height:1.6; color:#0f172a;">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px; justify-content:center;">
        ${brand.logoUrl ? `<img src="${brand.logoUrl}" alt="${escapeHtml(brand.name)}" style="height:32px;" />` : ''}
        <span style="font-size:20px; font-weight:700;">${escapeHtml(brand.name)}</span>
      </div>
      <h2 style="margin:0 0 12px 0; font-size:22px; color:#020617; text-align:center;">Redefinir senha</h2>
      <p style="margin:0 0 8px 0; color:#475569;">Recebemos um pedido para redefinir sua senha no ${escapeHtml(brand.name)}.</p>
      ${resetUrl ? `<div style="text-align:center; margin:24px 0;"><a href="${resetUrl}" style="display:inline-block; background:#E3B23C; color:#020617; text-decoration:none; padding:12px 24px; border-radius:12px; font-weight:700; font-size:14px;">Redefinir senha</a></div>` : ''}
      ${expiresEm ? `<p style="margin:0 0 8px 0; font-size:13px; color:#475569;">Este link expira em <strong>${escapeHtml(expiresEm)}</strong>.</p>` : ''}
      <hr style="border:0; border-top:1px solid #e2e8f0; margin:24px 0;" />
      ${brand.supportEmail ? `<p style="margin:0; font-size:12px; color:#64748b;">Suporte: <a href="mailto:${escapeHtml(brand.supportEmail)}">${escapeHtml(brand.supportEmail)}</a></p>` : ''}
      <p style="margin:10px 0 0 0; font-size:12px; color:#64748b;">© 2026 Moxi Soluções. Todos os direitos reservados.</p>
    </div>
  </div>
  `
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

export async function buildLifecycleReminderEmail(args: {
  subject: string
  title: string
  previewText: string
  centroNome: string
  message: string
  actionUrl?: string | null
  actionLabel?: string | null
  contactEmail?: string | null
  contactWhatsapp?: string | null
}) {
  const element = createElement(KlasseLifecycleReminderEmail, {
    title: args.title,
    previewText: args.previewText,
    centroNome: args.centroNome,
    message: args.message,
    actionUrl: args.actionUrl ?? null,
    actionLabel: args.actionLabel ?? null,
    contactEmail: args.contactEmail ?? null,
    contactWhatsapp: args.contactWhatsapp ?? null,
  })
  const html = await render(element)
  const text = await render(element, { plainText: true })
  return { subject: args.subject, html, text }
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

export function buildCredentialsEmail(args: { nome?: string | null; email: string; numero_processo_login?: string | null; senha_temp?: string | null; escolaNome?: string | null; loginUrl?: string | null }) {
  const { nome, email, numero_processo_login, senha_temp, escolaNome, loginUrl } = args
  const brand = getBranding()
  const subject = `${brand.name} • Seus dados de acesso${escolaNome ? ` • ${escolaNome}` : ''}`
  const text = [
    nome ? `Olá, ${nome}.` : `Olá,`,
    `Suas credenciais foram configuradas no ${brand.name}${escolaNome ? ` para a escola "${escolaNome}"` : ''}.`,
    `Login: ${email}`,
    numero_processo_login ? `Número de processo (login): ${numero_processo_login}` : '',
    senha_temp ? `Senha temporária: ${senha_temp}` : '',
    loginUrl ? `Acesse: ${loginUrl}` : '',
    senha_temp ? `Por segurança, altere sua senha após o primeiro acesso.` : '',
  ].filter(Boolean).join('\n')

  const html = `
  <div style="background-color:#f8fafc; margin:0; padding:24px 8px; font-family:Helvetica, Arial, sans-serif;">
    <div style="border:1px solid #eaeaea; border-radius:16px; margin:40px auto; padding:20px; max-width:465px; background-color:#ffffff; box-shadow:0 1px 4px rgba(15,23,42,0.08); line-height:1.6; color:#0f172a;">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px; justify-content:center;">
        ${brand.logoUrl ? `<img src="${brand.logoUrl}" alt="${escapeHtml(brand.name)}" style="height:32px;" />` : ''}
        <span style="font-size:20px; font-weight:700;">${escapeHtml(brand.name)}</span>
      </div>
      <h2 style="margin:0 0 12px 0; font-size:22px; color:#020617; text-align:center;">Seus dados de acesso</h2>
      ${nome ? `<p style="margin:0 0 8px 0;">Olá, <strong>${escapeHtml(nome)}</strong>.</p>` : '<p style="margin:0 0 8px 0;">Olá,</p>'}
      <p style="margin:0 0 8px 0; color:#475569;">Suas credenciais foram configuradas${escolaNome ? ` para a escola <strong>${escapeHtml(escolaNome)}</strong>` : ''}.</p>
      <p style="margin:0 0 8px 0; color:#475569;">Login: <strong>${escapeHtml(email)}</strong></p>
      ${numero_processo_login ? `<p style="margin:0 0 8px 0; color:#475569;">Número de processo (login): <strong>${escapeHtml(numero_processo_login)}</strong></p>` : ''}
      ${senha_temp ? `<p style="margin:0 0 8px 0; color:#475569;">Senha temporária: <strong>${escapeHtml(senha_temp)}</strong></p>` : ''}
      ${loginUrl ? `<div style="text-align:center; margin:24px 0;"><a href="${loginUrl}" style="display:inline-block; background:#E3B23C; color:#020617; text-decoration:none; padding:12px 24px; border-radius:12px; font-weight:700; font-size:14px;">Entrar no KLASSE</a></div>` : ''}
      ${senha_temp ? `<p style="margin:0 0 8px 0; font-size:13px; color:#334155;">Por segurança, altere sua senha após o primeiro acesso.</p>` : ''}
      <hr style="border:0; border-top:1px solid #e2e8f0; margin:24px 0;" />
      <p style="margin:0; font-size:12px; color:#64748b;">Este e-mail foi enviado para ${escapeHtml(email)}.</p>
      ${brand.supportEmail ? `<p style="margin:8px 0 0 0; font-size:12px; color:#64748b;">Suporte: <a href="mailto:${escapeHtml(brand.supportEmail)}">${escapeHtml(brand.supportEmail)}</a></p>` : ''}
      <p style="margin:10px 0 0 0; font-size:12px; color:#64748b;">© 2026 Moxi Soluções. Todos os direitos reservados.</p>
    </div>
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
  const rawFrom = process.env.RESEND_FROM_EMAIL || 'Klasse <suporte@klasse.ao>'
  const from = rawFrom.replace(/\\n/g, '').replace(/\r?\n/g, '').trim()
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
