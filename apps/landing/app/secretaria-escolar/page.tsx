import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Secretaria Escolar com Fluxo Disciplinado | KLASSE',
  description:
    'Secretaria escolar com matrículas, documentos e histórico centralizados para reduzir duplicação manual.',
  alternates: {
    canonical: 'https://klasse.ao/secretaria-escolar',
  },
}

export default function SecretariaEscolarPage() {
  return (
    <main className="seo-page">
      <div className="container">
        <div className="seo-header">
          <div className="sec-eyebrow">Secretaria</div>
          <h1 className="sec-title">Secretaria escolar com ritmo e previsibilidade.</h1>
          <p className="sec-sub">
            Matrículas, documentos e histórico organizados para reduzir improviso e acelerar o fluxo diário.
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
            A secretaria trabalha com dados confiáveis, sem duplicação de planilhas ou confirmações manuais. O fluxo
            diário fica mais rápido e rastreável.
          </p>
        </div>

        <div className="seo-grid">
          <div className="seo-card">
            <h3 className="seo-card-title">Histórico centralizado</h3>
            <p className="seo-card-text">Tudo num só lugar para evitar erros e retrabalho.</p>
          </div>
          <div className="seo-card">
            <h3 className="seo-card-title">Documentos com ritmo</h3>
            <p className="seo-card-text">Emissão de documentos sem espera e sem papel disperso.</p>
          </div>
          <div className="seo-card">
            <h3 className="seo-card-title">Fluxo diário mais rápido</h3>
            <p className="seo-card-text">Menos improviso e mais previsibilidade para a equipa.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
