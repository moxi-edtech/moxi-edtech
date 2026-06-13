import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Escola Moderna com Portal do Aluno e Matrícula Online',
  description:
    'Uma página pública para pais, alunos e diretores conhecerem matrícula online, portal do aluno e diagnóstico de gestão escolar.',
  alternates: {
    canonical: 'https://klasse.ao/escola-moderna',
  },
}

type EscolaModernaPageProps = {
  searchParams?: Promise<{
    ref?: string | string[]
  }>
}

function getRefValue(ref: string | string[] | undefined) {
  if (Array.isArray(ref)) return ref[0] ?? ''
  return ref ?? ''
}

export default async function EscolaModernaPage({ searchParams }: EscolaModernaPageProps) {
  const params = await searchParams
  const ref = getRefValue(params?.ref).trim()
  const refQuery = ref ? `?ref=${encodeURIComponent(ref)}` : ''
  const publicUrl = `https://klasse.ao/escola-moderna${refQuery}`
  const onboardingHref = `https://app.klasse.ao/onboarding${refQuery}`
  const whatsappText = [
    'Olá, direção.',
    'Vi esta proposta de matrícula online e portal do aluno para escolas.',
    'Acho que seria importante a nossa escola conhecer:',
    publicUrl,
  ].join('\n')

  return (
    <section className="seo-page">
      <div className="container">
        <div className="seo-header">
          <div className="sec-eyebrow">Escola Moderna</div>
          <h1 className="sec-title">A escola do seu filho ainda depende de fila, papel e WhatsApp?</h1>
          <p className="sec-sub">
            Uma escola moderna já oferece matrícula online, portal do aluno, notas, avisos e documentos digitais num
            só lugar.
          </p>
          <div className="seo-actions">
            <a className="btn-p" href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`} target="_blank" rel="noopener noreferrer">
              Enviar para a minha escola
            </a>
            <a className="btn-s" href={onboardingHref}>
              Sou diretor, quero modernizar
            </a>
          </div>
        </div>

        <div className="seo-block">
          <h2 className="seo-title">O que os pais já esperam</h2>
          <p className="seo-text">
            Menos deslocações, menos espera e mais transparência. O KLASSE ajuda escolas a modernizar a experiência
            de atendimento sem transformar a secretaria num caos operacional.
          </p>
        </div>

        <div className="seo-grid">
          <div className="seo-card">
            <h3 className="seo-card-title">Matrícula online</h3>
            <p className="seo-card-text">Pré-admissão, dados e documentos num fluxo mais claro para a escola e para os pais.</p>
          </div>
          <div className="seo-card">
            <h3 className="seo-card-title">Portal do aluno</h3>
            <p className="seo-card-text">Notas, avisos, documentos e informação escolar acessíveis sem depender de grupos dispersos.</p>
          </div>
          <div className="seo-card">
            <h3 className="seo-card-title">Gestão com visibilidade</h3>
            <p className="seo-card-text">A direção acompanha gargalos de secretaria, cobranças e operação com dados mais confiáveis.</p>
          </div>
        </div>

        <div className="seo-block">
          <h2 className="seo-title">Para diretores e proprietários</h2>
          <p className="seo-text">
            Se os pais já começam a cobrar uma experiência digital, o próximo passo é medir onde a escola está hoje.
            O pedido de onboarding recolhe dados como dimensão da escola e faixa de propina para a equipa KLASSE
            avaliar o potencial da modernização e preparar uma proposta adequada.
          </p>
          <div className="seo-actions">
            <a className="btn-p" href={onboardingHref}>
              Começar pedido da escola
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
