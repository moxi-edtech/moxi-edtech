'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'

import { FadeIn, FadeInStagger } from '../FadeIn'

export function DashboardSection() {
  const bullets = [
    'Receita prevista e receita realizada',
    'Turmas e alunos com atraso prioritário',
    'Alertas operacionais e financeiros no mesmo painel',
    'Indicadores para a gestão diária',
  ]

  return (
    <section className="dashboard section-accent" id="dashboard">
      <div className="container dashboard-grid">
        <FadeIn direction="right" className="dashboard-copy">
          <h2 className="sec-title">
            A escola vista pela direcção
          </h2>
          <p className="sec-sub">
            Acompanhe receitas, propinas em atraso e os principais indicadores académicos e financeiros.
          </p>
          <FadeInStagger className="dashboard-bullets">
            {bullets.map((bullet) => (
              <FadeIn key={bullet} direction="up" className="dashboard-bullet">
                <span className="dashboard-bullet-dot" />
                <span>{bullet}</span>
              </FadeIn>
            ))}
          </FadeInStagger>
        </FadeIn>

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="dashboard-visual"
          aria-label="Exemplo de dashboard KLASSE"
        >
          <div className="dashboard-real-frame dashboard-real-frame--notebook">
            <div className="dashboard-frame">
              <div className="dashboard-bar"><span /><span /><span /></div>
              <div className="dashboard-screen dashboard-screen--real">
                <Image src="/assets/dashboard-notebook.png" alt="Dashboard KLASSE apresentado num notebook" fill sizes="(max-width: 900px) 100vw, 52vw" />
              </div>
            </div>
            <div className="dashboard-neck" />
            <div className="dashboard-stand" />
            <div className="dashboard-base" />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
