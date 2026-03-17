import type { Metadata } from 'next'

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
      </div>
    </main>
  )
}
