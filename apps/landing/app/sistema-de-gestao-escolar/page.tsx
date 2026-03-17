import type { Metadata } from 'next'

const faqItems = [
  {
    question: 'O KLASSE funciona para escolas públicas e privadas?',
    answer:
      'Sim. O KLASSE é pensado para a realidade angolana, incluindo escolas públicas e privadas com diferentes tamanhos e processos.',
  },
  {
    question: 'Preciso de instalar algum software na escola?',
    answer:
      'Não. O KLASSE é uma plataforma online com acesso seguro por navegador e telemóvel, sem instalação local.',
  },
  {
    question: 'O sistema ajuda com propinas e documentos MED?',
    answer:
      'Sim. Há controlo de pagamentos, emissão de documentos e relatórios essenciais para a gestão escolar.',
  },
  {
    question: 'Como é feita a implementação do sistema?',
    answer:
      'A equipa KLASSE acompanha a configuração, importação de alunos e formação da equipa escolar.',
  },
] as const

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqItems.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
}

export const metadata: Metadata = {
  title: 'Sistema de Gestão Escolar em Angola | KLASSE',
  description:
    'O KLASSE é um sistema de gestão escolar desenvolvido para escolas em Angola. Controle alunos, notas, turmas, horários e pagamentos numa única plataforma.',
  alternates: {
    canonical: 'https://klasse.ao/sistema-de-gestao-escolar',
  },
  openGraph: {
    title: 'Sistema de Gestão Escolar em Angola | KLASSE',
    description:
      'Gestão escolar completa para Angola: alunos, notas, turmas, horários e pagamentos numa única plataforma.',
    url: 'https://klasse.ao/sistema-de-gestao-escolar',
    siteName: 'KLASSE',
    locale: 'pt_AO',
    type: 'website',
    images: [
      {
        url: 'https://klasse.ao/og-image.png',
        width: 1200,
        height: 630,
        alt: 'KLASSE — Sistema de Gestão Escolar em Angola',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sistema de Gestão Escolar em Angola | KLASSE',
    description:
      'Gestão escolar completa para Angola: alunos, notas, turmas, horários e pagamentos numa única plataforma.',
    images: ['https://klasse.ao/og-image.png'],
  },
}

export default function SistemaGestaoEscolarPage() {
  return (
    <main className="seo-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <div className="container">
        <div className="seo-header">
          <div className="sec-eyebrow">Sistema de gestão escolar</div>
          <h1 className="sec-title">Sistema de Gestão Escolar em Angola | KLASSE</h1>
          <p className="sec-sub">
            O KLASSE é um sistema de gestão escolar desenvolvido para escolas em Angola. Centralize alunos, notas,
            turmas, horários e pagamentos numa única plataforma, com portais dedicados para secretária, professores,
            direcção, alunos e encarregados.
          </p>
        </div>

        <div className="seo-block">
          <h2 className="seo-title">Tudo numa só plataforma</h2>
          <p className="seo-text">
            Controle matrículas, propinas, documentos MED, presenças e desempenho académico em tempo real. Cada
            utilizador vê apenas o que precisa, garantindo segurança e clareza na operação diária da escola.
          </p>
        </div>

        <div className="seo-grid">
          <div className="seo-card">
            <h3 className="seo-card-title">Secretária e direcção</h3>
            <p className="seo-card-text">
              Acompanhe pagamentos, gere matrículas e tenha visão completa das turmas com relatórios claros.
            </p>
          </div>
          <div className="seo-card">
            <h3 className="seo-card-title">Professores</h3>
            <p className="seo-card-text">
              Registe presenças e notas de forma simples, com dados disponíveis para a direcção na hora.
            </p>
          </div>
          <div className="seo-card">
            <h3 className="seo-card-title">Alunos e encarregados</h3>
            <p className="seo-card-text">
              Cada aluno acompanha o seu percurso académico e os encarregados recebem informações relevantes.
            </p>
          </div>
        </div>

        <div className="seo-block">
          <h2 className="seo-title">Pronto para começar?</h2>
          <p className="seo-text">
            Veja como o KLASSE se adapta à realidade das escolas em Angola e descubra os planos disponíveis.
          </p>
          <div className="seo-actions">
            <a className="btn-p" href="/#precos">
              Ver preços
            </a>
            <a className="btn-s" href="/#contato">
              Agendar demonstração
            </a>
          </div>
        </div>

        <div className="seo-block">
          <h2 className="seo-title">Perguntas frequentes</h2>
          <div className="seo-faq">
            {faqItems.map((item) => (
              <div key={item.question} className="seo-faq-item">
                <h3 className="seo-faq-question">{item.question}</h3>
                <p className="seo-faq-answer">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
