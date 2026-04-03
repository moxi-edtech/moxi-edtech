 'use client'

import { useEffect, useState } from 'react'

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
      title: 'Secretaria presa ao papel e Excel',
      description:
        'Matrículas, notas e propinas em processos manuais geram atraso, erros e retrabalho diário.',
    },
    {
      title: 'Encarregados sem visibilidade',
      description:
        'A secretaria vira call center para responder sobre notas, faltas e pagamentos que já deviam estar no portal.',
    },
    {
      title: 'Documentos MED demorados',
      description:
        'Declarações e pautas ainda dependem de fila, papel e assinatura presencial para tarefas que podiam sair em minutos.',
    },
    {
      title: 'Risco de incumprimento regulatório',
      description:
        'Sem histórico digital fiável, a escola fica mais exposta em auditorias e exigências do MED.',
    },
  ] as const

  const visibleProblems = isMobile && !expanded ? problems.slice(0, 2) : problems

  return (
    <section className="problema z reveal section-bg section-bg-audience section-accent" id="para-quem">
      <div className="container">
        <div className="audience-layout">
          <div>
            <div className="sec-eyebrow">Para quem é</div>
            <h2 className="sec-title">
              Se estes problemas já são da <span className="audience-escola">sua escola</span>, o{' '}
              <span className="audience-klasse">KLASSE</span> é para si.
            </h2>
            <p className="sec-sub">
              Escolas privadas que já cresceram e precisam de operação organizada, dados fiáveis e visão diária da gestão.
            </p>
          </div>

          <div className="audience-problem-list">
            {visibleProblems.map((problem, index) => (
              <article key={problem.title} className="audience-problem-card">
                <div className="audience-problem-num">{String(index + 1).padStart(2, '0')}</div>
                <div>
                  <h3 className="audience-problem-title">{problem.title}</h3>
                  <p className="audience-problem-desc">{problem.description}</p>
                </div>
              </article>
            ))}
            <button
              type="button"
              className="audience-more-btn"
              onClick={() => setExpanded((prev) => !prev)}
            >
              {expanded ? 'Ver menos' : 'Ver mais'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
