import { useMemo, useState } from 'react'

type PortalSlide = {
  id: 'aluno' | 'professor' | 'diretor'
  tab: string
  badge: string
  title: string
  description: string
  points: string[]
}

const slides: PortalSlide[] = [
  {
    id: 'diretor',
    tab: 'Diretor',
    badge: 'Portal do Diretor',
    title: 'Caixa, risco e operacao em segundos.',
    description: 'O diretor acompanha receitas, atrasos e movimento diario sem depender de relatorios manuais.',
    points: ['Receita prevista vs realizada em tempo real', 'Radar de inadimplencia com prioridades', 'Entradas recentes para decisao rapida'],
  },
  {
    id: 'aluno',
    tab: 'Aluno',
    badge: 'Portal do Aluno',
    title: 'O seu filho na palma da mao.',
    description: 'Notas, presencas e propinas em tempo real.',
    points: ['Notas por disciplina em segundos', 'Presencas com historico claro', 'Propinas visiveis sem ir a secretaria'],
  },
  {
    id: 'professor',
    tab: 'Professor',
    badge: 'Portal do Professor',
    title: 'Portal do Professor, igual ao ambiente real.',
    description: 'Resumo do dia, minhas turmas e agenda semanal com os mesmos blocos da tela real.',
    points: ['Aulas hoje, turmas ativas, avaliacoes pendentes e faltas a lancar', 'Acoes diretas: Registrar Presencas e Lancar Notas', 'Turmas por disciplina e agenda organizada por dia'],
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
                <div className="ph-logo" aria-hidden="true">
                  <img src="/logo-klasse.png" alt="" />
                </div>
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

  if (activeId === 'professor') {
    return (
      <div className="device-stage device-stage--professor">
        <div className="portais-device-head">
          <span className="post-brand">KLASSE</span>
          <span className="post-headline">Portal do Professor</span>
        </div>
        <div className="android-shell">
          <div className="android-frame">
            <div className="android-screen">
              <div className="and-status"><span>07:00</span><span>4G - 87%</span></div>
              <div className="and-header">
                <div className="ph-logo" aria-hidden="true">
                  <img src="/logo-klasse.png" alt="" />
                </div>
                <div className="ph-header-text">
                  <div className="ph-portal-lbl">Portal do Professor</div>
                  <div className="ph-escola">Colegio Nova Geracao</div>
                </div>
              </div>
              <div className="and-student-bar"><span className="alvid-pill">Prof. Mateus Neto</span></div>
              <div className="and-content">
                <div className="and-professor-resumo">
                  <div className="and-section-lbl">Resumo do dia</div>
                  <div className="and-meta-grid and-meta-grid--professor">
                    <div className="and-meta-card and-meta-card--professor"><small>Aulas hoje</small><strong>6</strong></div>
                    <div className="and-meta-card and-meta-card--professor"><small>Turmas ativas</small><strong>4</strong></div>
                    <div className="and-meta-card and-meta-card--professor"><small>Avaliacoes pendentes</small><strong>3</strong></div>
                    <div className="and-meta-card and-meta-card--professor"><small>Faltas a lancar</small><strong>2</strong></div>
                  </div>
                  <div className="and-quick-actions">
                    <button type="button" className="and-action-chip and-action-chip--active">Registrar Presencas</button>
                    <button type="button" className="and-action-chip">Lancar Notas</button>
                  </div>
                </div>
                <div className="and-section-lbl and-section-lbl-tight">Minhas turmas</div>
                <div className="disc-item disc-item--professor">
                  <span>Turma 9B</span>
                  <strong>Matematica</strong>
                </div>
                <div className="disc-item disc-item--professor">
                  <span>Turma 8A</span>
                  <strong>Fisica</strong>
                </div>
                <div className="disc-item disc-item--professor">
                  <span>Turma 7C</span>
                  <strong className="warn">Quimica</strong>
                </div>
                <div className="and-section-lbl and-section-lbl-tight">Agenda semanal</div>
                <div className="disc-item disc-item--professor">
                  <span>Segunda</span>
                  <strong>08:00-09:40</strong>
                </div>
              </div>
              <div className="and-nav"><span>Inicio</span><span className="active">Turmas</span><span>Frequencias</span><span>Notas</span><span>Perfil</span></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="device-stage device-stage--diretor">
      <div className="portais-device-head">
        <span className="post-brand">KLASSE</span>
        <span className="post-headline">Portal do Diretor</span>
      </div>
      <div className="director-shell">
        <div className="director-frame">
          <div className="director-bar">
            <span />
            <span />
            <span />
          </div>
          <div className="director-screen">
            <div className="director-kpis">
              <article>
                <small>Alunos ativos</small>
                <strong>583</strong>
              </article>
              <article>
                <small>Turmas</small>
                <strong>24</strong>
              </article>
              <article>
                <small>Professores</small>
                <strong>47</strong>
              </article>
              <article>
                <small>Financeiro</small>
                <strong className="ok">78%</strong>
              </article>
            </div>

            <div className="director-revenue">
              <div className="director-revenue-row">
                <span>Previsao de receita</span>
                <strong>Kz 4.2M / Kz 5.4M</strong>
              </div>
              <div className="director-revenue-bar">
                <i style={{ width: '78%' }} />
              </div>
              <p className="director-revenue-note">78% realizado no periodo actual</p>
            </div>

            <div className="director-grid">
              <div className="director-panel">
                <p className="director-panel-title">Entradas de hoje</p>
                <div className="director-item">
                  <span>Transferencia</span>
                  <strong>Kz 84.000</strong>
                </div>
                <div className="director-item">
                  <span>TPA</span>
                  <strong>Kz 46.000</strong>
                </div>
                <div className="director-item">
                  <span>Referencia</span>
                  <strong>Kz 23.000</strong>
                </div>
              </div>
              <div className="director-panel">
                <p className="director-panel-title">Atencao prioritaria</p>
                <div className="director-item">
                  <span>Turma 9B</span>
                  <strong className="late">35 dias</strong>
                </div>
                <div className="director-item">
                  <span>Turma 11A</span>
                  <strong className="warn">18 dias</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PortalsSection() {
  const [activeId, setActiveId] = useState<PortalSlide['id']>('diretor')
  const [visibleId, setVisibleId] = useState<PortalSlide['id']>('diretor')
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
          <div className="sec-eyebrow">O sistema</div>
          <h2 className="sec-h">Cada pessoa vê o que precisa.</h2>
          <p className="sec-p">Cada perfil trabalha no seu próprio fluxo, com menos ruído e mais velocidade de execução.</p>
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
