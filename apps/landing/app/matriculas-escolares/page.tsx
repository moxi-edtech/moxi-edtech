import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Matrículas Escolares com Fluxo Controlado | KLASSE',
  description:
    'Matrículas com confirmação documental, vagas e rematrículas num fluxo previsível para secretarias escolares.',
  alternates: {
    canonical: 'https://klasse.ao/matriculas-escolares',
  },
}

export default function MatriculasEscolaresPage() {
  return (
    <main className="seo-page">
      <div className="container">
        <div className="seo-header">
          <div className="sec-eyebrow">Matrículas</div>
          <h1 className="sec-title">Matrículas escolares sem retrabalho e sem improviso.</h1>
          <p className="sec-sub">
            Admissões, vagas e rematrículas num fluxo disciplinado para secretarias que precisam de previsibilidade.
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
            O KLASSE organiza a matrícula com confirmação documental e histórico do aluno. A secretaria trabalha com
            ritmo e a direção acompanha o fluxo sem ruído.
          </p>
        </div>

        <div className="seo-grid">
          <div className="seo-card">
            <h3 className="seo-card-title">Fluxo previsível</h3>
            <p className="seo-card-text">Admissões e rematrículas com etapas claras e menos pendências ocultas.</p>
          </div>
          <div className="seo-card">
            <h3 className="seo-card-title">Documentação organizada</h3>
            <p className="seo-card-text">Confirmação documental sem arquivos dispersos ou perda de tempo.</p>
          </div>
          <div className="seo-card">
            <h3 className="seo-card-title">Histórico centralizado</h3>
            <p className="seo-card-text">Tudo num só lugar para evitar duplicação e erros de secretaria.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
