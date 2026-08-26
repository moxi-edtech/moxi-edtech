'use client'

import { FormEvent, useState } from 'react'

type EbookVariant = 'matriculas' | 'futuro'

const ebookConfig = {
  matriculas: {
    downloadPath: '/assets/klasse-ebook-planeamento-matriculas-2026-2027.pdf',
    coverPath: '/assets/ebook-matriculas-capa.png',
    title: <>Prepare a sua escola<br /><em>para as matrículas.</em></>,
    alt: 'Capa do e-book Prepare a sua escola para as matrículas',
    lead: 'Um guia prático para organizar equipa, documentos e processos antes do início do ano lectivo.',
    benefits: ['Planeamento da equipa', 'Comunicação com famílias', 'Documentos e processos', 'Matrículas mais organizadas'],
    formTitle: <>Receba o e-book<br />gratuitamente.</>,
    formIntro: 'Preencha os seus dados e comece a preparar a sua escola.',
    guideTitle: <>O que vai encontrar<br /><em>no guia.</em></>,
    guideItems: ['Organize a equipa', 'Prepare os processos', 'Organize os documentos', 'Comunique-se com famílias', 'Prepare as matrículas'],
    closingTitle: <>Feito para a realidade<br /><em>da escola.</em></>,
    closingCopy: 'O KLASSE ajuda direção, secretaria, professores, financeiro, alunos e encarregados a trabalharem numa única plataforma.',
    nextHref: '/ebook/futuro',
    nextLabel: 'Ver o guia sobre o futuro da educação',
  },
  futuro: {
    downloadPath: '/assets/klasse-ebook-futuro-da-educacao-em-angola-v11.pdf',
    coverPath: '/assets/ebook-futuro-educacao-capa-v12.png',
    title: <>O futuro da educação<br /><em>começa na escola.</em></>,
    alt: 'Capa do e-book O futuro da educação em Angola',
    lead: 'Um guia para gestores compreenderem tecnologia, inteligência artificial e as decisões que estão a moldar a escola.',
    benefits: ['Gestão escolar conectada', 'IA com responsabilidade', 'Professores com mais contexto', 'Preparação para 2026/2027'],
    formTitle: <>Receba o guia<br />gratuitamente.</>,
    formIntro: 'Deixe os seus dados e receba o guia sobre o futuro da educação.',
    guideTitle: <>O que está a<br /><em>mudar.</em></>,
    guideItems: ['A nova escola conectada', 'Tendências administrativas', 'Tendências pedagógicas', 'IA na educação', 'O desafio angolano'],
    closingTitle: <>Prepare a escola.<br /><em>Comece com clareza.</em></>,
    closingCopy: 'O KLASSE transforma tendências em processos concretos para direção, secretaria, professores e famílias.',
    nextHref: '/ebook',
    nextLabel: 'Ver o guia de preparação para matrículas',
  },
} as const

export default function EbookCapture({ variant = 'matriculas' }: { variant?: EbookVariant }) {
  const config = ebookConfig[variant]
  const downloadPath = config.downloadPath
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)

    const form = event.currentTarget
    const data = new FormData(form)
    const params = new URLSearchParams(window.location.search)
    const utm = Object.fromEntries(
      ['source', 'medium', 'campaign', 'content', 'term'].map((key) => [`utm_${key}`, params.get(`utm_${key}`)]),
    )

    const nome = String(data.get('nome') || '').trim()
    const escola = String(data.get('escola') || '').trim()
    const whatsapp = String(data.get('whatsapp') || '').trim()

    fetch('/api/ebook-leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome,
        escola,
        whatsapp,
        ebook: variant,
        utm,
      }),
    }).then(async (response) => {
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'lead_error')
      
      const ebookTitle = variant === 'futuro' ? 'O Futuro da Educação' : 'Guia de Matrículas 2026/2027'
      const textMsg = `Olá! Sou ${nome ? nome : 'gestor'} da escola ${escola ? escola : ''} e gostaria de receber o ${ebookTitle} no WhatsApp.`
      const waUrl = `https://wa.me/244933349106?text=${encodeURIComponent(textMsg)}`
      
      window.location.assign(waUrl)
    }).catch(() => {
      setSubmitted(false)
      setError('Não foi possível concluir agora. Tente novamente em instantes.')
    })
  }

  return (
    <main className="ebook-capture-page">
      <header className="ebook-capture-header">
        <a className="ebook-brand" href="/" aria-label="KLASSE, voltar ao início">
          <img src="/logo-klasse.png" alt="" />
          <span>KLASSE</span>
          <small>GESTÃO ESCOLAR INTELIGENTE</small>
        </a>
        <a className="ebook-header-link" href="https://klasse.ao" target="_blank" rel="noreferrer">
          klasse.ao
        </a>
      </header>

      <section className="ebook-capture-hero" aria-labelledby="ebook-title">
        <div className="ebook-capture-copy">
          <p className="ebook-kicker">E-BOOK GRATUITO <span>·</span> 2026/2027</p>
          <h1 id="ebook-title">
            {config.title}
          </h1>
          <p className="ebook-lead">
            {config.lead}
          </p>

          <ul className="ebook-benefits" aria-label="O que o guia ajuda a preparar">
            {config.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}
          </ul>

          <div className="ebook-cover-wrap">
            <span className="ebook-cover-note">Guia prático para gestores escolares</span>
            <img
              className="ebook-cover"
              src={config.coverPath}
              alt={config.alt}
            />
          </div>
        </div>

        <aside className="ebook-form-card" aria-labelledby="form-title">
          <div className="ebook-form-topline"><span /> DOWNLOAD GRATUITO</div>
          <h2 id="form-title">{config.formTitle}</h2>
          <p className="ebook-form-intro">{config.formIntro}</p>

          <form onSubmit={handleSubmit}>
            <label>
              <span>Nome</span>
              <input name="nome" type="text" autoComplete="name" placeholder="O seu nome" required />
            </label>
            <label>
              <span>Nome da escola</span>
              <input name="escola" type="text" autoComplete="organization" placeholder="Nome da escola" required />
            </label>
            <label>
              <span>WhatsApp</span>
              <input name="whatsapp" type="tel" autoComplete="tel" placeholder="+244 000 000 000" required />
            </label>
            <button type="submit" className="ebook-submit" disabled={submitted}>
              {submitted ? 'A conectar ao WhatsApp...' : 'RECEBER GUIA NO WHATSAPP'} <b aria-hidden="true">→</b>
            </button>
          </form>
          {error ? <p className="ebook-form-error" role="alert">{error}</p> : null}
          <p className="ebook-form-footnote"><span aria-hidden="true">✓</span> Gratuito. Sem compromisso.</p>
        </aside>
      </section>

      <section className="ebook-guide" aria-labelledby="guide-title">
        <div className="ebook-section-heading">
          <p className="ebook-kicker">DENTRO DO GUIA</p>
          <h2 id="guide-title">{config.guideTitle}</h2>
        </div>
        <div className="ebook-guide-grid">
          {config.guideItems.map((title, index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{title}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="ebook-closing" aria-labelledby="closing-title">
        <div>
          <p className="ebook-kicker">PARA A REALIDADE DA ESCOLA</p>
          <h2 id="closing-title">{config.closingTitle}</h2>
        </div>
        <div className="ebook-closing-copy">
          <p>{config.closingCopy}</p>
          <a className="ebook-closing-link" href="https://wa.me/244933349106?text=Olá%2C%20quero%20conhecer%20o%20KLASSE%20para%20a%20minha%20escola." target="_blank" rel="noreferrer">Falar com a equipa <span aria-hidden="true">→</span></a>
          <a className="ebook-closing-link ebook-secondary-link" href={config.nextHref}>{config.nextLabel} <span aria-hidden="true">↗</span></a>
        </div>
      </section>

      <footer className="ebook-capture-footer">
        <span>© KLASSE</span>
        <a href="https://klasse.ao" target="_blank" rel="noreferrer">klasse.ao</a>
      </footer>
    </main>
  )
}
