'use client'

import { useEffect, useState } from 'react'

import { FadeIn, FadeInStagger } from '../FadeIn'

export function AudienceSection() {
  const [isMobile, setIsMobile] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)')
    const sync = () => setIsMobile(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const problems = [
    {
      title: 'Registos dispersos',
      description:
        'Matrículas, notas e propinas em processos manuais geram atraso, erros e retrabalho diário.',
    },
    {
      title: 'Informação para os encarregados',
      description:
        'A secretaria recebe pedidos frequentes de informação sobre notas, faltas e pagamentos.',
    },
    {
      title: 'Emissão de documentos escolares',
      description:
        'Declarações e pautas ainda dependem de fila, papel e assinatura presencial para tarefas que podiam sair em minutos.',
    },
    {
      title: 'Histórico escolar',
      description:
        'Sem histórico digital fiável, a escola fica mais exposta em auditorias e exigências do MED.',
    },
  ] as const

  const visibleProblems = isMobile && !expanded ? problems.slice(0, 2) : problems

  return (
    <section className="problema z section-bg section-bg-audience section-accent" id="para-quem">
      <div className="container">
        <div className="audience-layout">
          <FadeIn direction="right">
            <h2 className="sec-title">
              Se estes problemas já são da <span className="audience-escola">sua escola</span>, o{' '}
              <span className="audience-klasse">KLASSE</span> é para si.
            </h2>
            <p className="sec-sub">
              O KLASSE foi concebido para a realidade administrativa e académica das escolas angolanas.
            </p>
          </FadeIn>

          <FadeInStagger className="audience-problem-list">
            {visibleProblems.map((problem, index) => (
              <FadeIn key={problem.title} direction="up" className="audience-problem-card">
                <div className="audience-problem-num">{String(index + 1).padStart(2, '0')}</div>
                <div>
                  <h3 className="audience-problem-title">{problem.title}</h3>
                  <p className="audience-problem-desc">{problem.description}</p>
                </div>
              </FadeIn>
            ))}
            <FadeIn direction="up">
              <button
                type="button"
                className="audience-more-btn"
                onClick={() => setExpanded((prev) => !prev)}
              >
                {expanded ? 'Ver menos' : 'Ver mais'}
              </button>
            </FadeIn>
          </FadeInStagger>
        </div>
      </div>
    </section>
  )
}
