import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'O seu e-book está pronto | KLASSE',
  description: 'Baixe o guia de preparação para as matrículas 2026/2027 e conheça o KLASSE.',
  robots: { index: false, follow: false },
}

export default async function ObrigadoPage({ searchParams }: { searchParams: Promise<{ ebook?: string }> }) {
  const params = await searchParams
  const isFuture = params.ebook === 'futuro'
  const guideName = isFuture ? 'o Guia O Futuro da Educação' : 'o Guia de Matrículas'
  const whatsappHref = `https://wa.me/244933349106?text=${encodeURIComponent(`Olá! Quero receber ${guideName} e agendar um diagnóstico para a minha escola.`)}`

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
        <p className="ebook-kicker">ENVIO NO WHATSAPP <span>·</span> 2026/2027</p>
        <h1 id="thanks-title">O seu guia<br /><em>está a caminho.</em></h1>
        <p className="ebook-thanks-lead">
          O assistente virtual do KLASSE está pronto para entregar o seu exemplar em PDF e agendar o diagnóstico da sua escola.
        </p>
        <div className="ebook-thanks-actions">
          <a className="ebook-submit ebook-thanks-primary" href={whatsappHref} target="_blank" rel="noreferrer">Receber Guia e Diagnóstico no WhatsApp <b aria-hidden="true">→</b></a>
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
