import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Resend } from 'resend'

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

async function run() {
  const envPath = resolve(process.cwd(), 'apps/web/.env.local')
  loadEnvFile(envPath)

  const apiKey = process.env.RESEND_API_KEY
  let from = (process.env.RESEND_FROM_EMAIL || 'KLASSE <suporte@klasse.ao>').replace(/\\n/g, '').replace(/\n/g, '').trim()
  
  if (!apiKey) {
    console.error('RESEND_API_KEY não encontrada.')
    process.exit(1)
  }

  const resend = new Resend(apiKey)

  const pathProposta = "/Users/gundja/Desktop/KLASSE · Proposta de Parceria.pdf"
  const pathContrato = "/Users/gundja/Desktop/KLASSE · Contrato Parceiro.pdf"

  const attachments = []
  if (existsSync(pathProposta)) {
    attachments.push({
      filename: "KLASSE · Proposta de Parceria.pdf",
      content: readFileSync(pathProposta)
    })
  }
  if (existsSync(pathContrato)) {
    attachments.push({
      filename: "KLASSE · Contrato Parceiro.pdf",
      content: readFileSync(pathContrato)
    })
  }

  const html = `
    <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
      <p>Olá <strong>Dário Seven</strong>, tudo bem?</p>
      
      <p>Seguindo a nossa conversa sobre a <strong>KLASSE</strong>, estou enviando os documentos para formalizarmos a nossa parceria.</p>
      
      <p>A ideia é ter você como um dos nossos Parceiros Fundadores, ajudando a levar a KLASSE para mais escolas em Angola e transformando a gestão educacional por aqui.</p>
      
      <p>Estou anexando dois documentos:</p>
      <ol>
        <li><strong>KLASSE · Proposta de Parceria.pdf</strong>: Explica os benefícios e como o modelo funciona na prática.</li>
        <li><strong>KLASSE · Contrato Parceiro.pdf</strong>: Onde formalizamos os detalhes, como os 15% de comissão sobre as escolas indicadas e as regras gerais.</li>
      </ol>
      
      <p>Dê uma olhada com calma e, se tiver qualquer dúvida, é só me chamar. Podemos marcar um papo rápido para alinhar os próximos passos e a assinatura.</p>
      
      <p>Estamos ansiosos para ter você no time!</p>
      
      <p>Abraço,</p>
      <p><strong>David Chocaliye</strong><br>MOXI SOLUÇÕES</p>
    </div>
  `

  console.log("Enviando e-mail corrigido (e-mail correto)...")
  const { data, error } = await resend.emails.send({
    from: from,
    to: ["dariosevennoficial@gmail.com"],
    cc: ["felizberta.adalgiza@gmail.com"],
    subject: "KLASSE · Parceria e Contrato (Dário Seven)",
    html: html,
    attachments: attachments
  })

  if (error) {
    console.error("Erro ao enviar:", error)
    process.exit(1)
  }

  console.log("E-mail enviado com sucesso! ID:", data?.id)
}

run().catch(console.error)
