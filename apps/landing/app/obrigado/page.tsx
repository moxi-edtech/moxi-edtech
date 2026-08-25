import type { Metadata } from 'next'

const ebookPath = '/assets/klasse-ebook-planeamento-matriculas-2026-2027.pdf'

export const metadata: Metadata = {
  title: 'O seu e-book está pronto | KLASSE',
  description: 'Baixe o guia de preparação para as matrículas 2026/2027 e conheça o KLASSE.',
  robots: { index: false, follow: false },
}

export default function ObrigadoPage() {
  const whatsappHref = 'https://wa.me/244933349106?text=Olá%2C%20acabei%20de%20baixar%20o%20e-book%20do%20KLASSE%20e%20quero%20agendar%20um%20diagnóstico%20gratuito%20para%20a%20minha%20escola.'

  return (
    <main className="ebook-thanks-page">
      <header className="ebook-capture-header">
        <a className="ebook-brand" href="/" aria-label="KLASSE, voltar ao início">
          <img src="/logo-klasse.png" alt="" />
          <span>KLASSE</span>
          <small>GESTÃO ESCOLAR INTELIGENTE</small>
        </a>
        <a className="ebook-header-link" href="https://klasse.ao" target="_blank" rel="noreferrer">klasse.ao</a>
      </header>

      <section className="ebook-thanks-content" aria-labelledby="thanks-title">
        <p className="ebook-kicker">DOWNLOAD CONFIRMADO <span>·</span> 2026/2027</p>
        <h1 id="thanks-title">O seu e-book<br /><em>está pronto.</em></h1>
        <p className="ebook-thanks-lead">
          Enquanto prepara a sua escola para 2026/2027, quer ver como esse processo funciona digitalmente no KLASSE?
        </p>
        <div className="ebook-thanks-actions">
          <a className="ebook-submit ebook-thanks-primary" href={whatsappHref} target="_blank" rel="noreferrer">Agendar diagnóstico no WhatsApp <b aria-hidden="true">→</b></a>
          <a className="ebook-thanks-download" href={ebookPath} download="KLASSE-Ebook-Planeamento-Matriculas-2026-2027.pdf">Baixar e-book novamente <span aria-hidden="true">↓</span></a>
        </div>
        <p className="ebook-thanks-signoff">Prepare a escola. Comece com uma conversa.</p>
      </section>

      <footer className="ebook-capture-footer">
        <span>© KLASSE</span>
        <a href="https://klasse.ao" target="_blank" rel="noreferrer">klasse.ao</a>
      </footer>
    </main>
  )
}
