'use client'

import { FormEvent, useState } from 'react'

const downloadPath = '/assets/klasse-ebook-planeamento-matriculas-2026-2027.pdf'

export default function EbookCapture() {
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

    fetch('/api/ebook-leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: data.get('nome'),
        escola: data.get('escola'),
        whatsapp: data.get('whatsapp'),
        utm,
      }),
    }).then(async (response) => {
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? 'lead_error')
      window.location.assign('/obrigado')
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
            Prepare a sua escola
            <br />
            <em>para as matrículas.</em>
          </h1>
          <p className="ebook-lead">
            Um guia prático para organizar equipa, documentos e processos antes do início do ano lectivo.
          </p>

          <ul className="ebook-benefits" aria-label="O que o guia ajuda a preparar">
            <li>Planeamento da equipa</li>
            <li>Comunicação com famílias</li>
            <li>Documentos e processos</li>
            <li>Matrículas mais organizadas</li>
          </ul>

          <div className="ebook-cover-wrap">
            <span className="ebook-cover-note">Guia prático para gestores escolares</span>
            <img
              className="ebook-cover"
              src="/assets/ebook-matriculas-capa.png"
              alt="Capa do e-book Prepare a sua escola para as matrículas"
            />
          </div>
        </div>

        <aside className="ebook-form-card" aria-labelledby="form-title">
          <div className="ebook-form-topline"><span /> DOWNLOAD GRATUITO</div>
          <h2 id="form-title">Receba o e-book<br />gratuitamente.</h2>
          <p className="ebook-form-intro">Preencha os seus dados e comece a preparar a sua escola.</p>

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
              {submitted ? 'A preparar o download...' : 'BAIXAR E-BOOK'} <b aria-hidden="true">→</b>
            </button>
          </form>
          {error ? <p className="ebook-form-error" role="alert">{error}</p> : null}
          <p className="ebook-form-footnote"><span aria-hidden="true">✓</span> Gratuito. Sem compromisso.</p>
        </aside>
      </section>

      <section className="ebook-guide" aria-labelledby="guide-title">
        <div className="ebook-section-heading">
          <p className="ebook-kicker">DENTRO DO GUIA</p>
          <h2 id="guide-title">O que vai encontrar<br /><em>no guia.</em></h2>
        </div>
        <div className="ebook-guide-grid">
          {[
            ['01', 'Organize a equipa'],
            ['02', 'Prepare os processos'],
            ['03', 'Organize os documentos'],
            ['04', 'Comunique-se com famílias'],
            ['05', 'Prepare as matrículas'],
          ].map(([number, title]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="ebook-closing" aria-labelledby="closing-title">
        <div>
          <p className="ebook-kicker">PARA A REALIDADE DA ESCOLA</p>
          <h2 id="closing-title">Feito para a realidade<br /><em>da escola.</em></h2>
        </div>
        <div className="ebook-closing-copy">
          <p>O KLASSE ajuda direção, secretaria, professores, financeiro, alunos e encarregados a trabalharem numa única plataforma.</p>
          <a className="ebook-closing-link" href="https://wa.me/244933349106?text=Olá%2C%20quero%20conhecer%20o%20KLASSE%20para%20a%20minha%20escola." target="_blank" rel="noreferrer">Falar com a equipa <span aria-hidden="true">→</span></a>
        </div>
      </section>

      <footer className="ebook-capture-footer">
        <span>© KLASSE</span>
        <a href="https://klasse.ao" target="_blank" rel="noreferrer">klasse.ao</a>
      </footer>
    </main>
  )
}
