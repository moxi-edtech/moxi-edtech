import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Presenças Escolares com Leitura Rápida | KLASSE',
  description:
    'Presenças escolares com visibilidade rápida para secretaria e direção, garantindo disciplina pedagógica.',
  alternates: {
    canonical: 'https://klasse.ao/presencas-escolares',
  },
}

export default function PresencasEscolaresPage() {
  return (
    <main className="seo-page">
      <div className="container">
        <div className="seo-header">
          <div className="sec-eyebrow">Presenças</div>
          <h1 className="sec-title">Presenças escolares com leitura rápida para toda a equipa.</h1>
          <p className="sec-sub">
            Frequência organizada para professores, secretaria e direção, sem relatórios manuais dispersos.
          </p>
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
          <h2 className="seo-title">O que resolve</h2>
          <p className="seo-text">
            Controle de frequência com leitura rápida para a equipa pedagógica. O diretor acompanha faltas críticas e
            a secretaria tem acesso imediato ao histórico.
          </p>
        </div>

        <div className="seo-grid">
          <div className="seo-card">
            <h3 className="seo-card-title">Frequência em tempo real</h3>
            <p className="seo-card-text">Visibilidade rápida sem depender de relatórios de papel.</p>
          </div>
          <div className="seo-card">
            <h3 className="seo-card-title">Histórico centralizado</h3>
            <p className="seo-card-text">Leitura clara do aluno e da turma para decisões pedagógicas.</p>
          </div>
          <div className="seo-card">
            <h3 className="seo-card-title">Disciplina operacional</h3>
            <p className="seo-card-text">Menos ruído entre professor, secretaria e direção.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
