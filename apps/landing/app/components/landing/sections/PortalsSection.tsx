import { useMemo, useState } from 'react'

type PortalSlide = {
  id: 'aluno' | 'encarregado' | 'academico'
  tab: string
  badge: string
  title: string
  description: string
  points: string[]
}

const slides: PortalSlide[] = [
  {
    id: 'aluno',
    tab: 'Aluno',
    badge: 'Portal do Aluno',
    title: 'O seu filho na palma da mao.',
    description: 'Notas, presencas e propinas em tempo real.',
    points: ['Notas por disciplina em segundos', 'Presencas com historico claro', 'Propinas visiveis sem ir a secretaria'],
  },
  {
    id: 'encarregado',
    tab: 'Encarregado',
    badge: 'Portal do Encarregado',
    title: 'Propinas e notas, sem filas.',
    description: 'Tudo visivel para o encarregado no mesmo painel.',
    points: ['Estado financeiro do aluno', 'Proximos pagamentos e pendencias', 'Acompanhamento academico continuo'],
  },
  {
    id: 'academico',
    tab: 'Academico',
    badge: 'Portal Academico',
    title: 'Notas em tempo real.',
    description: 'O aluno acompanha o proprio percurso sem friccao.',
    points: ['Disciplinas e desempenho por trimestre', 'Resumo rapido de progresso', 'Proxima aula e rotina organizada'],
  },
]

function DeviceMock({ activeId }: { activeId: PortalSlide['id'] }) {
  if (activeId === 'aluno') {
    return (
      <div className="device-stage device-stage--aluno">
        <div className="portais-device-head">
          <span className="post-brand">KLASSE</span>
          <span className="post-headline">Portal do Aluno</span>
        </div>
        <div className="phone">
          <div className="phone-shell">
            <div className="phone-notch" />
            <div className="phone-screen">
              <div className="ph-status"><span>07:00</span><span>5G 87%</span></div>
              <div className="ph-header">
                <div className="ph-logo">KL</div>
                <div className="ph-header-text">
                  <div className="ph-portal-lbl">Portal do Aluno</div>
                  <div className="ph-escola">Colegio Nova Geracao</div>
                </div>
              </div>
              <div className="ph-student-bar"><span className="alvid-pill">Mbemba Neto</span></div>
              <div className="ph-hero-card">
                <div className="ph-ano">Ano Lectivo 2025-2026</div>
                <div className="ph-name">Mbemba Lopes da Costa Neto</div>
                <div className="ph-pills">
                  <span className="pill pill-white">8.a Classe</span>
                  <span className="pill pill-dark">Turma 8A</span>
                </div>
                <div className="ph-stats">
                  <div className="ph-stat"><div className="ph-stat-lbl">Ultima Nota</div><div className="ph-stat-val">14</div></div>
                  <div className="ph-stat"><div className="ph-stat-lbl">Propinas</div><div className="ph-stat-val ph-stat-warn">0</div></div>
                  <div className="ph-stat"><div className="ph-stat-lbl">Proxima Aula</div><div className="ph-stat-val ph-stat-time">08:00</div></div>
                </div>
              </div>
              <div className="ph-section-hd"><span>Notas Recentes</span><span>Ver todas</span></div>
              <div className="ph-note-card"><div className="ph-note-row"><span>Matematica</span><strong>14</strong></div><div className="ph-bar"><i style={{ width: '70%' }} /></div></div>
              <div className="ph-note-card"><div className="ph-note-row"><span>Portugues</span><strong>17</strong></div><div className="ph-bar"><i style={{ width: '85%' }} /></div></div>
              <div className="ph-note-card"><div className="ph-note-row"><span>Fisica</span><strong className="warn">12</strong></div><div className="ph-bar"><i className="warn" style={{ width: '60%' }} /></div></div>
              <div className="ph-nav"><span className="active">Inicio</span><span>Academico</span><span>Financeiro</span><span>Docs</span><span>Avisos</span></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (activeId === 'encarregado') {
    return (
      <div className="device-stage device-stage--encarregado">
        <div className="portais-device-head light">
          <span className="post-brand">KLASSE</span>
          <span className="post-headline">Portal do Encarregado</span>
        </div>
        <div className="tablet-shell">
          <div className="tablet-frame">
            <div className="tablet-screen">
              <div className="tab-status"><span>07:00</span><span>WiFi - Colegio Nova Geracao</span></div>
              <div className="tab-header">
                <div className="ph-logo">KL</div>
                <div className="ph-header-text">
                  <div className="ph-portal-lbl">Portal do Aluno - Colegio Nova Geracao</div>
                  <div className="ph-escola">Mbemba Neto - 5.a Classe - Turma 5B</div>
                </div>
                <span className="alvid-pill">Mbemba Neto</span>
              </div>
              <div className="tab-layout">
                <div className="tab-col">
                  <div className="tab-col-title">Financeiro</div>
                  <div className="fin-card paid"><small>Pago em 2026</small><strong>Kz 230.000</strong></div>
                  <div className="fin-card pend"><small>Pendente</small><strong>Kz 46.000</strong></div>
                  <div className="mens-title">Mensalidades</div>
                  <div className="mens-row"><span>Marco 2026</span><b>Pagar</b></div>
                  <div className="mens-row"><span>Abril 2026</span><b>Pagar</b></div>
                </div>
                <div className="tab-col">
                  <div className="tab-col-title">Notas - 1.o Trimestre</div>
                  <div className="tab-note-card"><div className="ph-note-row"><span>Matematica</span><strong>16</strong></div><div className="ph-bar"><i style={{ width: '80%' }} /></div></div>
                  <div className="tab-note-card"><div className="ph-note-row"><span>Portugues</span><strong>18</strong></div><div className="ph-bar"><i style={{ width: '90%' }} /></div></div>
                  <div className="tab-note-card"><div className="ph-note-row"><span>Ciencias</span><strong className="warn">13</strong></div><div className="ph-bar"><i className="warn" style={{ width: '65%' }} /></div></div>
                  <div className="tab-note-card"><div className="ph-note-row"><span>Historia</span><strong>15</strong></div><div className="ph-bar"><i style={{ width: '75%' }} /></div></div>
                </div>
              </div>
              <div className="tab-nav"><span>Inicio</span><span>Academico</span><span className="active">Financeiro</span><span>Docs</span><span>Avisos</span></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="device-stage device-stage--academico">
      <div className="portais-device-head">
        <span className="post-brand">KLASSE</span>
        <span className="post-headline">Portal Academico</span>
      </div>
      <div className="float-stat top"><strong>14.8</strong><small>Media geral</small></div>
      <div className="float-stat bottom"><strong>7</strong><small>Disciplinas</small></div>
      <div className="android-shell">
        <div className="android-frame">
          <div className="android-screen">
            <div className="and-status"><span>07:00</span><span>4G - 87%</span></div>
            <div className="and-header">
              <div className="ph-logo">KL</div>
              <div className="ph-header-text">
                <div className="ph-portal-lbl">Portal do Aluno</div>
                <div className="ph-escola">Colegio Nova Geracao</div>
              </div>
            </div>
            <div className="and-student-bar"><span className="alvid-pill">Mbemba Neto</span></div>
            <div className="and-content">
              <div className="and-section-lbl">Desempenho por disciplina</div>
              <div className="disc-item"><span>Biologia</span><strong className="warn">12</strong></div>
              <div className="disc-item"><span>Ed. Moral e Civica</span><strong>16</strong></div>
              <div className="disc-item"><span>Educacao Fisica</span><strong>18</strong></div>
              <div className="disc-item"><span>Fisica</span><strong className="warn">11</strong></div>
              <div className="and-section-lbl and-section-lbl-tight">Resumo do trimestre</div>
              <div className="and-meta-grid">
                <div className="and-meta-card"><small>Media</small><strong>14.8</strong></div>
                <div className="and-meta-card"><small>Presenca</small><strong>96%</strong></div>
              </div>
              <div className="and-next-class"><span>Proxima aula</span><strong>Matematica - 08:00</strong></div>
            </div>
            <div className="and-nav"><span>Inicio</span><span className="active">Academico</span><span>Financeiro</span><span>Docs</span><span>Avisos</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PortalsSection() {
  const [activeId, setActiveId] = useState<PortalSlide['id']>('aluno')
  const [visibleId, setVisibleId] = useState<PortalSlide['id']>('aluno')
  const [isFading, setIsFading] = useState(false)

  const activeSlide = useMemo(() => slides.find((slide) => slide.id === visibleId) ?? slides[0], [visibleId])

  const handleSwap = (nextId: PortalSlide['id']) => {
    if (nextId === visibleId || isFading) return
    setActiveId(nextId)
    setIsFading(true)
    window.setTimeout(() => {
      setVisibleId(nextId)
      setIsFading(false)
    }, 140)
  }

  return (
    <section className="portais reveal section-accent" id="portais">
      <div className="container">
        <div className="portais-device-intro">
          <div className="sec-label">O sistema</div>
          <h2 className="sec-h">Cada pessoa ve o que precisa.</h2>
          <p className="sec-p">Uma experiencia unica por dispositivo, com conteudo que muda por perfil.</p>
        </div>

        <div className="portais-swap" aria-label="Portais KLASSE com troca de perfil">
          <div className={`portais-swap-media portais-swap-media--${activeSlide.id}${isFading ? ' is-fading' : ''}`}>
            <DeviceMock activeId={activeSlide.id} />
          </div>

          <div className={`portais-swap-panel${isFading ? ' is-fading' : ''}`}>
            <div className="portais-swap-tabs" role="tablist" aria-label="Trocar perfil">
              {slides.map((slide) => {
                const isActive = slide.id === activeId
                return (
                  <button
                    key={slide.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`portais-swap-tab${isActive ? ' is-active' : ''}`}
                    onClick={() => handleSwap(slide.id)}
                  >
                    {slide.tab}
                  </button>
                )
              })}
            </div>

            <div className="portais-swap-content" role="tabpanel">
              <h3>{activeSlide.title}</h3>
              <p>{activeSlide.description}</p>
              <ul>
                {activeSlide.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>

            <div className="portais-swap-actions">
              <a className="btn-p" href="#onboarding">
                Pedir demo guiada
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
