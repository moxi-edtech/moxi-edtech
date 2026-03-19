import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Notas Escolares com Menos Retrabalho | KLASSE',
  description:
    'Notas escolares e pautas com fluxo claro entre professores, secretaria e direção, sem fricção operacional.',
  alternates: {
    canonical: 'https://klasse.ao/notas-escolares',
  },
}

export default function NotasEscolaresPage() {
  return (
    <main className="seo-page">
      <div className="container">
        <div className="seo-header">
          <div className="sec-eyebrow">Notas</div>
          <h1 className="sec-title">Notas escolares com clareza e ritmo operacional.</h1>
          <p className="sec-sub">
            Avaliações, pautas e histórico académico ligados ao fluxo real da escola, sem retrabalho informal.
          </p>
          <div className="seo-actions">
            <a className="btn-p" href="/#contacto">
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
            O professor lança notas com menos fricção, a secretaria valida com segurança e a direção acompanha o
            desempenho com rastreabilidade.
          </p>
        </div>

        <div className="seo-grid">
          <div className="seo-card">
            <h3 className="seo-card-title">Lançamento sem fricção</h3>
            <p className="seo-card-text">Notas e pautas sem troca manual de ficheiros ou mensagens dispersas.</p>
          </div>
          <div className="seo-card">
            <h3 className="seo-card-title">Rastreabilidade académica</h3>
            <p className="seo-card-text">Histórico organizado para secretaria e direção tomarem decisão rápida.</p>
          </div>
          <div className="seo-card">
            <h3 className="seo-card-title">Menos retrabalho</h3>
            <p className="seo-card-text">Fluxo claro entre professores e secretaria sem duplicação de dados.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
