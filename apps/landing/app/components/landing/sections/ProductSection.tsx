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
      title: 'Fecho de caixa com mais controlo',
      description:
        'O operador declara primeiro. O sistema confere depois. Mais transparência para cada recebimento.',
      icon: Wallet,
    },
    {
      title: 'Documentos sem filas',
      description:
        'Declarações e documentos emitidos em lote, em segundos, sem repetir o mesmo trabalho na secretaria.',
      icon: BookOpen,
    },
    {
      title: 'Matrículas sem retrabalho',
      description:
        'Matrículas e rematrículas organizadas por turma, com os dados certos desde o primeiro registo.',
      icon: Users,
    },
    {
      title: 'Atrasos que aparecem cedo',
      description:
        'Veja quem está em dívida, organize as prioridades e aja antes que o problema cresça.',
      icon: CalendarCheck,
    },
    {
      title: 'O professor trabalha onde está',
      description:
        'Notas e presenças lançadas no telemóvel, no ritmo da aula e sem depender da secretaria.',
      icon: ClipboardCheck,
    },
    {
      title: 'Famílias com informação clara',
      description:
        'Notas, presenças e situação financeira no mesmo portal, sem mensagens espalhadas.',
      icon: BarChart3,
    },
  ]

  const visibleFeatures = isMobile ? features.slice(mobilePage * 3, mobilePage * 3 + 3) : features

  return (
    <section className="features z section-bg section-bg-product section-accent" id="produto">
      <div className="container">
        <FadeIn className="product-intro product-intro--slide">
          <div className="sec-eyebrow">O que muda no dia a dia</div>
          <h2 className="sec-title product-title-main">Menos tarefas espalhadas. Mais escola a funcionar.</h2>
          <p className="sec-sub">O KLASSE transforma os processos que mais consomem tempo em fluxos claros, acompanháveis e integrados.</p>
        </FadeIn>

        <FadeIn className="product-film" direction="up">
          <div className="product-film-copy">
            <div className="sec-eyebrow">Feito para a rotina real</div>
            <h3>Menos troca de contexto. Mais tempo para a escola.</h3>
            <p>O KLASSE aproxima as pessoas e os processos que já fazem parte do dia a dia da instituição.</p>
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
            <span className="product-film-live"><i /> produto em movimento</span>
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
            <h3>Conciliacao bancaria assistida</h3>
            <p>Upload e matching automatico para fechar o ciclo financeiro com menos erro manual.</p>
          </FadeIn>
          <FadeIn direction="up" className="product-highlight-card">
            <h3>Relatorios para a direcao</h3>
            <p>Visao diaria do academico e financeiro para decisoes rapidas.</p>
          </FadeIn>
        </FadeInStagger>
      </div>
    </section>
  )
}
