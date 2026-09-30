'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import Image from 'next/image'

import { FadeIn } from '../FadeIn'

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
    title: 'Notas, avaliações e pautas no mesmo lugar.',
    description: 'O professor lança notas, acompanha a turma e publica a pauta sem depender da secretaria.',
    points: ['Pauta Digital por turma e disciplina', 'Lançamento de notas com histórico claro', 'Publicação pronta para direção e encarregados'],
  },
]

function DeviceMock({ activeId }: { activeId: PortalSlide['id'] }) {
  if (activeId === 'aluno') {
    return (
      <div className="device-stage device-stage--aluno">
        <div className="portais-device-head">
          <span className="post-brand"><img src="/logo-klasse.png" alt="" />KLASSE</span>
          <span className="post-headline">Portal do Aluno</span>
        </div>
        <div className="portal-real-mobile">
          <Image src="/assets/device-hero-clean.png" alt="Portal do aluno KLASSE no telemóvel com lupa" fill sizes="(max-width: 900px) 92vw, 42vw" />
        </div>
        <div className="phone portal-legacy-phone" aria-hidden="true">
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
          <span className="post-brand"><img src="/logo-klasse.png" alt="" />KLASSE</span>
          <span className="post-headline">Portal do Professor</span>
        </div>
        <div className="dashboard-real-frame dashboard-real-frame--notebook portal-professor-dashboard">
          <div className="dashboard-frame">
            <div className="dashboard-bar"><span /><span /><span /></div>
            <div className="dashboard-screen dashboard-screen--real dashboard-screen--teacher">
              <div className="teacher-portal-ui">
                <aside className="teacher-sidebar">
                  <div className="teacher-brand">
                    <span className="teacher-logo-box"><img src="/logo-klasse.png" alt="" /></span>
                    <span><b>KLASSE</b><small>gestão escolar</small></span>
                  </div>
                  <div className="teacher-sidebar-context">Portal do Professor</div>
                  <nav className="teacher-nav">
                    <span><i />Início</span>
                    <span><i />Frequências</span>
                    <span className="active"><i />Notas</span>
                    <span><i />Materiais</span>
                    <span><i />Calendário</span>
                    <span><i />Perfil</span>
                  </nav>
                  <div className="teacher-school"><small>Escola</small><b>Klasse Luanda</b></div>
                </aside>
                <main className="teacher-workspace">
                  <div className="teacher-topbar">
                    <div><small>Professor</small><b>Portal do professor</b></div>
                    <span className="teacher-sync">Salvo</span>
                  </div>
                  <div className="teacher-hero-row">
                    <div><small>Lançamento de notas</small><h3>Pauta Digital</h3><p>Matemática · 10ª A · Iº Trimestre</p></div>
                    <button type="button">Publicar pauta</button>
                  </div>
                  <div className="teacher-kpis">
                    <article><small>Alunos</small><b>32</b></article>
                    <article><small>Avaliações</small><b>3/4</b></article>
                    <article><small>Média</small><b>15.8</b></article>
                  </div>
                  <div className="teacher-gradebook">
                    <div className="teacher-gradebook-head"><b>Lançamento de Notas</b><span>Sincronizado</span></div>
                    <div className="teacher-table">
                      <div className="teacher-tr teacher-th"><span>Nº</span><span>Nome do Aluno</span><span>Status</span><span>MAC</span><span>NPP</span><span>NPT</span><span>MT1</span></div>
                      <div className="teacher-tr"><span>01</span><span><i />Ana Manuel</span><span className="ok">Salvo</span><span>16</span><span>15</span><span>17</span><b>16.0</b></div>
                      <div className="teacher-tr highlight"><span>02</span><span><i />Bruno José</span><span className="saving">A salvar</span><span>14</span><span>13</span><span>15</span><b>14.0</b></div>
                      <div className="teacher-tr"><span>03</span><span><i />Carla Domingos</span><span className="ok">Salvo</span><span>18</span><span>17</span><span>19</span><b>18.0</b></div>
                      <div className="teacher-tr"><span>04</span><span><i />Elisa Mateus</span><span className="ok">Salvo</span><span>15</span><span>16</span><span>16</span><b>15.7</b></div>
                    </div>
                  </div>
                </main>
              </div>
            </div>
          </div>
          <div className="dashboard-neck" />
          <div className="dashboard-stand" />
          <div className="dashboard-base" />
        </div>
      </div>
    )
  }

  return (
    <div className="device-stage device-stage--diretor">
      <div className="portais-device-head">
        <span className="post-brand"><img src="/logo-klasse.png" alt="" />KLASSE</span>
        <span className="post-headline">Portal do Diretor</span>
      </div>
      <div className="dashboard-real-frame dashboard-real-frame--notebook portal-director-dashboard">
        <div className="dashboard-frame">
          <div className="dashboard-bar"><span /><span /><span /></div>
          <div className="dashboard-screen dashboard-screen--real">
            <Image
              src="/assets/dashboard-notebook.png"
              alt="Dashboard real do KLASSE para direção"
              fill
              sizes="(max-width: 900px) 92vw, 42vw"
            />
          </div>
        </div>
        <div className="dashboard-neck" />
        <div className="dashboard-stand" />
        <div className="dashboard-base" />
      </div>
    </div>
  )
}

export function PortalsSection() {
  const [activeId, setActiveId] = useState<PortalSlide['id']>('aluno')

  const activeSlide = slides.find((slide) => slide.id === activeId) ?? slides[0]

  return (
    <section className="portais section-accent" id="portais">
      <div className="container">
        <FadeIn className="portais-device-intro">
          <div className="sec-eyebrow">O sistema</div>
          <h2 className="sec-h">Cada pessoa vê o que precisa.</h2>
          <p className="sec-p">Cada perfil trabalha no seu próprio fluxo, com menos ruído e mais velocidade de execução.</p>
        </FadeIn>

        <div className="portais-swap" aria-label="Portais KLASSE com troca de perfil">
          <div className="portais-swap-media">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeId}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className={`portais-swap-media-inner portais-swap-media--${activeId}`}
              >
                <DeviceMock activeId={activeId} />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="portais-swap-panel">
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
                    onClick={() => setActiveId(slide.id)}
                  >
                    {slide.tab}
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="portais-swap-tab-indicator"
                        style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--gx)', zIndex: -1, borderRadius: '8px' }}
                      />
                    )}
                  </button>
                )
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="portais-swap-content"
                role="tabpanel"
              >
                <h3>{activeSlide.title}</h3>
                <p>{activeSlide.description}</p>
                <ul>
                  {activeSlide.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>

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
