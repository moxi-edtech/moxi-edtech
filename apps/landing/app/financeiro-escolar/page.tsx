import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Financeiro Escolar com Previsibilidade',
  description:
    'Financeiro escolar com propinas organizadas, previsibilidade de entrada e menos ruído operacional.',
  alternates: {
    canonical: 'https://klasse.ao/financeiro-escolar',
  },
}

export default function FinanceiroEscolarPage() {
  return (
    <main className="seo-page">
      <div className="container">
        <div className="seo-header">
          <div className="sec-eyebrow">Financeiro</div>
          <h1 className="sec-title">Financeiro escolar com disciplina e previsibilidade.</h1>
          <p className="sec-sub">
            Gestão de propinas conectada ao fluxo académico para reduzir ruído e melhorar a cobrança.
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
            O financeiro ganha previsibilidade com cobranças organizadas, reconciliação simples e visibilidade por
            turma e período.
          </p>
        </div>

        <div className="seo-grid">
          <div className="seo-card">
            <h3 className="seo-card-title">Cobrança com base real</h3>
            <p className="seo-card-text">Dados claros de pagamentos e atrasos sem ruído operacional.</p>
          </div>
          <div className="seo-card">
            <h3 className="seo-card-title">Reconciliação simples</h3>
            <p className="seo-card-text">Menos esforço para fechar o mês e mais rastreio do caixa.</p>
          </div>
          <div className="seo-card">
            <h3 className="seo-card-title">Visão por período</h3>
            <p className="seo-card-text">Controle financeiro alinhado à realidade da sua escola.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
