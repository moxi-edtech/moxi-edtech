import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Resend } from 'resend'

type Args = {
  to?: string
  subject?: string
  html?: string
  text?: string
  from?: string
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
    if (key === 'subject') args.subject = next
    if (key === 'html') args.html = next
    if (key === 'text') args.text = next
    if (key === 'from') args.from = next
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
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1)
    }
    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function printHelp() {
  const lines = [
    'Uso:',
    '  pnpm tsx apps/web/scripts/resend-test.ts --to "email@exemplo.com"',
    '',
    'Opções:',
    '  --to       Destinatário (obrigatório)',
    '  --from     Remetente (opcional, usa RESEND_FROM_EMAIL)',
    '  --subject  Assunto (opcional)',
    '  --html     Corpo HTML (opcional)',
    '  --text     Corpo texto (opcional)',
  ]
  console.log(lines.join('\n'))
}

async function run() {
  const envPath = resolve(process.cwd(), 'apps/web/.env.local')
  loadEnvFile(envPath)
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    return
  }

  const apiKey = process.env.RESEND_API_KEY
  const defaultFrom = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !(args.from || defaultFrom)) {
    console.error('Defina RESEND_API_KEY e RESEND_FROM_EMAIL antes de testar.')
    process.exit(1)
  }

  if (!args.to) {
    printHelp()
    process.exit(1)
  }

  const resend = new Resend(apiKey)
  const subject = args.subject || 'Teste Resend'
  const html = args.html || '<p>Teste enviado via Resend.</p>'
  const text = args.text || 'Teste enviado via Resend.'

  const response = await resend.emails.send({
    from: args.from || defaultFrom || 'no-reply@invalid.local',
    to: [args.to],
    subject,
    html,
    text,
  })

  if (response.error) {
    console.error(`Erro: ${response.error.message}`)
    process.exit(1)
  }

  console.log('Email enviado com sucesso.')
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Erro: ${message}`)
  process.exit(1)
})
