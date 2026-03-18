import type { Metadata } from 'next'

const faqItems = [
  {
    question: 'KLASSE é um sistema de gestão escolar em Angola?',
    answer:
      'Sim. A proposta comercial e o copy da homepage foram alinhados para responder diretamente à procura por sistema de gestão escolar em Angola.',
  },
  {
    question: 'É software de gestão escolar só para académico?',
    answer:
      'Não. A plataforma escolar cobre gestão de propinas, matrículas, notas e presenças, ligando operação académica e financeira.',
  },
  {
    question: 'O login compete com a homepage pelas mesmas keywords?',
    answer:
      'Não. O /login continua marcado como página secundária de acesso, com metadata não indexável para evitar canibalização.',
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
          <div className="sec-eyebrow">KLASSE</div>
          <h1 className="sec-title">Software de gestão escolar para escolas que querem crescer com mais controlo e menos improviso operacional.</h1>
          <p className="sec-sub">
            Sistema de gestão escolar em Angola com foco comercial e execução operacional séria.
          </p>
          <div className="seo-actions">
            <a className="btn-p" href="/login">
              Aceder ao sistema
            </a>
            <a className="btn-s" href="/#contato">
              Pedir demo
            </a>
          </div>
        </div>

        <div className="seo-block">
          <p className="seo-text">
            KLASSE é o sistema de gestão escolar em Angola que funciona como software de gestão escolar e plataforma
            escolar para propinas, matrículas, notas e presenças. Se a sua escola ainda opera com Excel, WhatsApp e
            confirmações manuais, você está a perder margem. KLASSE posiciona-se como plataforma escolar para dar
            previsibilidade à direção, velocidade à secretaria, disciplina ao financeiro e fluidez aos professores.
          </p>
        </div>

        <div className="seo-block">
          <h2 className="seo-title">Proposta comercial</h2>
          <p className="seo-text">
            Sistema de gestão escolar em Angola para escolas privadas e equipas que precisam de mais rigor operacional.
          </p>
          <div className="seo-grid">
            <div className="seo-card">
              <h3 className="seo-card-title">Software de gestão escolar</h3>
              <p className="seo-card-text">
                Software de gestão escolar com foco em propinas, matrículas, notas e presenças numa operação conectada.
              </p>
            </div>
            <div className="seo-card">
              <h3 className="seo-card-title">Plataforma escolar</h3>
              <p className="seo-card-text">
                Plataforma escolar que reduz ruído entre direção, secretaria, financeiro e professores.
              </p>
            </div>
          </div>
          <div className="seo-actions">
            <a className="btn-p" href="/#contato">
              Pedir demo
            </a>
            <a className="btn-s" href="/login">
              Aceder ao sistema
            </a>
          </div>
        </div>

        <div className="seo-block">
          <h2 className="seo-title">Intenção de pesquisa</h2>
          <p className="seo-text">
            Headings e copy visível alinhados com as pesquisas comerciais que queremos ganhar.
          </p>
          <div className="seo-grid">
            <div className="seo-card">
              <h3 className="seo-card-title">Sistema de gestão escolar em Angola</h3>
              <p className="seo-card-text">
                Uma operação escolar mais disciplinada para direção, secretaria, financeiro e professores, sem
                depender de processos manuais dispersos.
              </p>
            </div>
            <div className="seo-card">
              <h3 className="seo-card-title">Software de gestão escolar</h3>
              <p className="seo-card-text">
                KLASSE liga fluxo académico e financeiro numa única base para escolas que precisam de controlo,
                rastreabilidade e execução séria.
              </p>
            </div>
            <div className="seo-card">
              <h3 className="seo-card-title">Plataforma escolar</h3>
              <p className="seo-card-text">
                A plataforma escolar organiza propinas, matrículas, notas e presenças com clareza operacional para
                cada equipa.
              </p>
            </div>
          </div>
        </div>

        <div className="seo-block">
          <h2 className="seo-title">Módulos com intenção comercial</h2>
          <p className="seo-text">
            O software de gestão escolar precisa mostrar claramente o que resolve.
          </p>
          <div className="seo-grid">
            <div className="seo-card">
              <h3 className="seo-card-title">Gestão de propinas</h3>
              <p className="seo-card-text">Cobranças, atrasos, pagamentos e visibilidade financeira sem folhas soltas.</p>
            </div>
            <div className="seo-card">
              <h3 className="seo-card-title">Matrículas</h3>
              <p className="seo-card-text">Admissões, vagas, rematrículas e confirmação documental num fluxo mais previsível.</p>
            </div>
            <div className="seo-card">
              <h3 className="seo-card-title">Notas</h3>
              <p className="seo-card-text">Avaliações, pautas e histórico académico com menos retrabalho entre secretaria e professores.</p>
            </div>
            <div className="seo-card">
              <h3 className="seo-card-title">Presenças</h3>
              <p className="seo-card-text">Frequência e faltas com leitura rápida para equipa pedagógica e direção.</p>
            </div>
          </div>
        </div>

        <div className="seo-block">
          <h2 className="seo-title">Benefícios por persona</h2>
          <p className="seo-text">
            A homepage precisa vender para quem decide e para quem executa.
          </p>
          <div className="seo-grid">
            <div className="seo-card">
              <h3 className="seo-card-title">Direção</h3>
              <p className="seo-card-text">
                Mais controlo institucional sobre operação académica e financeira. Melhor leitura de gargalos antes de
                virarem crise operacional.
              </p>
            </div>
            <div className="seo-card">
              <h3 className="seo-card-title">Secretaria</h3>
              <p className="seo-card-text">
                Matrículas, documentos e histórico com menos duplicação manual. Fluxo diário mais rápido e menos
                dependente de planilhas paralelas.
              </p>
            </div>
            <div className="seo-card">
              <h3 className="seo-card-title">Financeiro</h3>
              <p className="seo-card-text">
                Gestão de propinas com mais previsibilidade e menos ruído operacional. Base melhor para cobrança,
                reconciliação e acompanhamento de inadimplência.
              </p>
            </div>
            <div className="seo-card">
              <h3 className="seo-card-title">Professores</h3>
              <p className="seo-card-text">
                Lançamento de notas e presenças sem fricção informal com secretaria. Turmas e disciplinas mais
                organizadas para a rotina pedagógica.
              </p>
            </div>
          </div>
        </div>

        <div className="seo-block">
          <h2 className="seo-title">FAQ</h2>
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
