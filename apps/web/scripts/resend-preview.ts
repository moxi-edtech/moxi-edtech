import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { sendMail, buildOnboardingEmail, buildInviteEmail, buildResetPasswordEmail, buildGradesPublishedEmail, buildPaymentReceiptEmail } from '@/lib/mailer'

type Args = {
  to?: string
  template?: string
  name?: string
  help?: boolean
}

function parseArgs(argv: string[]): Args {
  const args: Args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--help' || value === '-h') {
      args.help = true
      continue
    }
    if (!value?.startsWith('--')) continue
    const key = value.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) continue
    if (key === 'to') args.to = next
    if (key === 'template') args.template = next
    if (key === 'name') args.name = next
    index += 1
  }
  return args
}

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return
  const content = readFileSync(filePath, 'utf8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) continue
    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
}

function printHelp() {
  console.log([
    'Uso:',
    '  pnpm tsx apps/web/scripts/resend-preview.ts --to "email@exemplo.com" --template onboarding',
    '',
    'Templates:',
    '  onboarding | invite | reset | grades | receipt',
  ].join('\n'))
}

async function run() {
  loadEnvFile(resolve(process.cwd(), 'apps/web/.env.local'))
  const args = parseArgs(process.argv.slice(2))
  if (args.help) return printHelp()
  if (!args.to) {
    printHelp()
    process.exit(1)
  }

  const template = (args.template || 'onboarding').toLowerCase()
  let payload: { subject: string; html: string; text: string }

  switch (template) {
    case 'invite':
      payload = buildInviteEmail({
        escolaNome: 'Colégio Horizonte',
        onboardingUrl: 'https://klasse.ao/convite/TOKEN',
        convidadoEmail: args.to,
        convidadoNome: 'Ana Beatriz',
        papel: 'professor',
      })
      break
    case 'reset':
      payload = buildResetPasswordEmail({
        resetUrl: 'https://klasse.ao/reset/TOKEN',
        expiresEm: '1 hora',
      })
      break
    case 'grades':
      payload = buildGradesPublishedEmail({
        escolaNome: 'Colégio Horizonte',
        alunoNome: 'Mbemba Lopes',
        turmaNome: '10.ª Classe · Turma A',
        periodoLabel: '1.º Trimestre',
        notas: [
          { disciplina: 'Matemática', nota: 16, destaque: 'positivo' },
          { disciplina: 'Língua Portuguesa', nota: 14, destaque: 'positivo' },
          { disciplina: 'Física', nota: 11, destaque: 'alerta' },
          { disciplina: 'Química', nota: 15, destaque: 'positivo' },
        ],
        media: '14.0',
        portalUrl: 'https://klasse.ao/portal',
      })
      break
    case 'receipt':
      payload = buildPaymentReceiptEmail({
        escolaNome: 'Colégio Horizonte',
        reciboNumero: '2026-0312-001',
        valor: 'Kz 46.000',
        referencia: 'Propina Mar/2026',
        alunoNome: 'Mbemba Lopes',
        turmaNome: '10.ª A',
        dataPagamento: '12 de Março de 2026',
        portalUrl: 'https://klasse.ao/portal/financeiro',
      })
      break
    case 'onboarding':
    default:
      payload = buildOnboardingEmail({
        escolaNome: 'Colégio Horizonte',
        onboardingUrl: 'https://klasse.ao',
        adminEmail: args.to,
        adminNome: args.name || 'Dr. Adilson',
        plano: 'Profissional',
      })
      break
  }

  const res = await sendMail({ to: args.to, subject: payload.subject, html: payload.html, text: payload.text })
  if (!res.ok) {
    console.error(`Erro: ${res.error}`)
    process.exit(1)
  }

  console.log(`Email enviado (${template}).`)
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Erro: ${message}`)
  process.exit(1)
})
