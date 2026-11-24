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
    title: 'Acompanhamento da gestão escolar',
    description: 'Consulte receitas, propinas em atraso e o movimento diário da escola.',
    points: ['Receita prevista e receita realizada', 'Propinas em atraso', 'Recebimentos recentes'],
  },
  {
    id: 'aluno',
    tab: 'Aluno',
    badge: 'Portal do Aluno',
    title: 'Notas, presenças e propinas',
    description: 'O aluno e o encarregado podem consultar o percurso escolar no telemóvel.',
    points: ['Notas por disciplina', 'Histórico de presenças', 'Consulta da situação financeira'],
  },
  {
    id: 'professor',
    tab: 'Professor',
    badge: 'Portal do Professor',
    title: 'Avaliação e acompanhamento da turma',
    description: 'O professor regista notas e presenças e acompanha as avaliações da turma.',
    points: ['Pauta Digital por turma e disciplina', 'Lançamento de notas com histórico claro', 'Consulta dos resultados por período'],
  },
]

function DeviceMock({ activeId }: { activeId: PortalSlide['id'] }) {
  if (activeId === 'aluno') {
    return (
      <div className="device-stage device-stage--aluno">
        <figure className="student-portal-preview" aria-label="Exemplo ilustrativo do portal do aluno">
          <header className="student-preview-header">
            <img src="/logo-klasse.png" alt="" />
            <div><strong>Portal do Aluno</strong><small>8.ª classe · 1.º trimestre</small></div>
          </header>
          <div className="student-preview-body">
            <h3>O meu percurso escolar</h3>
            <section className="student-preview-section">
              <h4>Notas por disciplina</h4>
              <dl>
                <div><dt>Matemática</dt><dd>14 / 20</dd></div>
                <div><dt>Língua Portuguesa</dt><dd>17 / 20</dd></div>
                <div><dt>Física</dt><dd>12 / 20</dd></div>
              </dl>
            </section>
            <section className="student-preview-section">
              <h4>Propinas</h4>
              <dl><div><dt>Novembro</dt><dd className="student-preview-paid">Liquidada</dd></div></dl>
            </section>
          </div>
          <figcaption>Exemplo ilustrativo · dados fictícios</figcaption>
        </figure>
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
                <div className="teacher-workspace">
                  <div className="teacher-topbar">
                    <div><small>Professor</small><b>Portal do professor</b></div>
                    <span className="teacher-sync">Salvo</span>
                  </div>
                  <div className="teacher-hero-row">
                    <div><small>Lançamento de notas</small><h3>Pauta Digital</h3><p>Matemática · 10ª A · Iº Trimestre</p></div>
                    <button type="button" disabled>Publicar pauta</button>
                  </div>
                  <div className="teacher-kpis">
                    <article><small>Alunos</small><b>32</b></article>
                    <article><small>Avaliações</small><b>3/4</b></article>
                    <article><small>Média</small><b>15.8</b></article>
                  </div>
                  <div className="teacher-gradebook">
                    <div className="teacher-gradebook-head"><b>Lançamento de Notas</b><span>Exemplo ilustrativo</span></div>
                    <div className="teacher-table">
                      <div className="teacher-tr teacher-th"><span>Nº</span><span>Nome do Aluno</span><span>Status</span><span>MAC</span><span>NPP</span><span>NPT</span><span>MT1</span></div>
                      <div className="teacher-tr"><span>01</span><span><i />Ana Manuel</span><span className="ok">Salvo</span><span>16</span><span>15</span><span>17</span><b>16.0</b></div>
                      <div className="teacher-tr highlight"><span>02</span><span><i />Bruno José</span><span className="saving">A salvar</span><span>14</span><span>13</span><span>15</span><b>14.0</b></div>
                      <div className="teacher-tr"><span>03</span><span><i />Carla Domingos</span><span className="ok">Salvo</span><span>18</span><span>17</span><span>19</span><b>18.0</b></div>
                      <div className="teacher-tr"><span>04</span><span><i />Elisa Mateus</span><span className="ok">Salvo</span><span>15</span><span>16</span><span>16</span><b>15.7</b></div>
                    </div>
                  </div>
                </div>
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
              alt="Painel de gestão escolar do KLASSE"
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
          <h2 className="sec-h">Um portal para cada função</h2>
          <p className="sec-p">A direcção, os professores e os alunos têm áreas próprias de trabalho e consulta.</p>
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
                Pedir demonstração
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
