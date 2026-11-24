'use client'

import { useEffect, useState } from 'react'

import {
  Users,
  Wallet,
  BookOpen,
  ClipboardCheck,
  CalendarCheck,
  BarChart3,
} from 'lucide-react'

import { FadeIn, FadeInStagger } from '../FadeIn'

export function ProductSection() {
  const [isMobile, setIsMobile] = useState(false)
  const [mobilePage, setMobilePage] = useState(0)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const sync = () => setIsMobile(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const features = [
    {
      title: 'Fecho de caixa',
      description:
        'O operador declara os recebimentos e o sistema permite conferir os valores no fecho de caixa.',
      icon: Wallet,
    },
    {
      title: 'Documentos escolares',
      description:
        'Emita declarações e documentos em lote a partir dos registos da escola.',
      icon: BookOpen,
    },
    {
      title: 'Matrículas e rematrículas',
      description:
        'Matrículas e rematrículas organizadas por turma, com os dados certos desde o primeiro registo.',
      icon: Users,
    },
    {
      title: 'Propinas em atraso',
      description:
        'Consulte os alunos com propinas em dívida e organize as cobranças.',
      icon: CalendarCheck,
    },
    {
      title: 'Notas e presenças',
      description:
        'Os professores registam avaliações e presenças por turma e disciplina.',
      icon: ClipboardCheck,
    },
    {
      title: 'Portal do aluno',
      description:
        'Alunos e encarregados consultam notas, presenças e a situação financeira.',
      icon: BarChart3,
    },
  ]

  const visibleFeatures = isMobile ? features.slice(mobilePage * 3, mobilePage * 3 + 3) : features

  return (
    <section className="features z section-bg section-bg-product section-accent" id="produto">
      <div className="container">
        <FadeIn className="product-intro product-intro--slide">
          <h2 className="sec-title product-title-main">Da matrícula ao fecho de caixa</h2>
          <p className="sec-sub">As operações académicas e financeiras partilham os mesmos registos da escola.</p>
        </FadeIn>

        <FadeIn className="product-film" direction="up">
          <div className="product-film-copy">
            <h3>Conheça o KLASSE</h3>
            <p>Veja como se apresenta o sistema.</p>
          </div>
          <div className="product-film-frame">
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster="/assets/implementation-wide.png"
              aria-label="Demonstração visual do KLASSE em uso"
              onLoadedData={(event) => {
                void event.currentTarget.play().catch(() => undefined)
              }}
              onClick={(event) => {
                void event.currentTarget.play().catch(() => undefined)
              }}
            >
              <source src="/assets/klasse-login-hero.mp4" type="video/mp4" />
            </video>
          </div>
        </FadeIn>

        <FadeInStagger className="product-showcase-grid">
          {visibleFeatures.map((feature, index) => {
            const Icon = feature.icon
            const iconVariant = index % 2 === 0 ? 'product-showcase-icon--green' : 'product-showcase-icon--gold'

            return (
              <FadeIn
                key={feature.title}
                direction="up"
                className="product-showcase-item"
              >
                <div className={`product-showcase-icon ${iconVariant}`}>
                  <Icon aria-hidden="true" />
                </div>
                <h3 className="product-showcase-title">{feature.title}</h3>
                <p className="product-showcase-desc">{feature.description}</p>
                <span className="product-showcase-accent" />
              </FadeIn>
            )
          })}
        </FadeInStagger>
        <div className="product-mobile-pager" role="tablist" aria-label="Páginas de funcionalidades">
          <button
            type="button"
            className={`product-mobile-page${mobilePage === 0 ? ' is-active' : ''}`}
            onClick={() => setMobilePage(0)}
            aria-label="Ver funcionalidades 1 a 3"
          />
          <button
            type="button"
            className={`product-mobile-page${mobilePage === 1 ? ' is-active' : ''}`}
            onClick={() => setMobilePage(1)}
            aria-label="Ver funcionalidades 4 a 6"
          />
        </div>

        <FadeInStagger className="product-highlight-row">
          <FadeIn direction="up" className="product-highlight-card">
            <h3>Conciliação bancária assistida</h3>
            <p>Importe comprovativos e acompanhe a conciliação dos pagamentos.</p>
          </FadeIn>
          <FadeIn direction="up" className="product-highlight-card">
            <h3>Relatórios para a direcção</h3>
            <p>Consulte indicadores académicos e financeiros da escola.</p>
          </FadeIn>
        </FadeInStagger>
      </div>
    </section>
  )
}
