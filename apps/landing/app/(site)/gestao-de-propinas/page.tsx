import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gestão de Propinas Escolar',
  description:
    'Gestão de propinas com previsibilidade, cobranças e rastreio financeiro para escolas que precisam de controlo real.',
  alternates: {
    canonical: 'https://klasse.ao/gestao-de-propinas',
  },
}

export default function GestaoDePropinasPage() {
  return (
    <main className="seo-page">
      <div className="container">
        <div className="seo-header">
          <div className="sec-eyebrow">Gestão de propinas</div>
          <h1 className="sec-title">Gestão de propinas com controlo financeiro real.</h1>
          <p className="sec-sub">
            Cobranças, atrasos e previsibilidade numa única base. Menos ruído operacional, mais visibilidade para a
            direção.
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
            A plataforma escolar organiza pagamentos e inadimplência com rastreio claro. A secretaria sabe quem pagou,
            o financeiro sabe quem falta, e a direção ganha previsibilidade.
          </p>
        </div>

        <div className="seo-grid">
          <div className="seo-card">
            <h3 className="seo-card-title">Cobranças com disciplina</h3>
            <p className="seo-card-text">Histórico de pagamentos, atrasos e reconciliação sem planilhas paralelas.</p>
          </div>
          <div className="seo-card">
            <h3 className="seo-card-title">Visão financeira por turma</h3>
            <p className="seo-card-text">Entenda onde está a receita e onde o risco operacional começa.</p>
          </div>
          <div className="seo-card">
            <h3 className="seo-card-title">Alertas e previsibilidade</h3>
            <p className="seo-card-text">Antecipe faltas de pagamento e organize a cobrança com menos improviso.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
