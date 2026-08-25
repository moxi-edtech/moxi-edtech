'use client'

import { track } from '@vercel/analytics'
import { motion, Variants } from 'framer-motion'
import Image from 'next/image'

interface HeroSectionProps {
  titleLines: string[]
  eyebrow: string
  subtitle: string
  primaryCta: { label: string; href: string }
  secondaryCta: { label: string; href: string }
  ebookCta: { label: string; href: string }
  note: string
}

export function HeroSection({ titleLines, eyebrow, subtitle, primaryCta, secondaryCta, ebookCta, note }: HeroSectionProps) {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.21, 0.47, 0.32, 0.98],
      },
    },
  }

  return (
    <section className="hero z section-accent">
      <div className="hero-ambient" aria-hidden="true" />
      <div className="container">
        <div className="hero-grid">
          <div className="hero-content">
          <motion.div
            className="hero-copy"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants} className="hero-eyebrow">
              <span className="hero-eyebrow-dot" />
              {eyebrow}
            </motion.div>
            <motion.h1 variants={itemVariants}>
              {titleLines.map((line, index) => (
                <span key={line}>
                  {line}
                  {index < titleLines.length - 1 && <br />}
                </span>
              ))}
            </motion.h1>
            <motion.p variants={itemVariants} className="hero-sub">
              {subtitle}
            </motion.p>
            <motion.div variants={itemVariants} className="hero-ctas">
              <a
                href={primaryCta.href}
                className="btn-p"
                onClick={() => track('conversion_click', { section: 'hero', label: primaryCta.label })}
              >
                {primaryCta.label}
              </a>
              <a
                href={secondaryCta.href}
                className="btn-s"
                onClick={() => track('conversion_click', { section: 'hero', label: secondaryCta.label })}
              >
                {secondaryCta.label}
              </a>
            </motion.div>
            <motion.a
              variants={itemVariants}
              href={ebookCta.href}
              className="hero-ebook-link"
              onClick={() => track('conversion_click', { section: 'hero', label: ebookCta.label })}
            >
              {ebookCta.label} <span aria-hidden="true">→</span>
            </motion.a>
            <motion.div variants={itemVariants} className="hero-proof">
              <span className="hero-proof-mark">K</span>
              <div className="proof-text"><strong>{note}</strong><span>Configuração e formação acompanhadas</span></div>
            </motion.div>
          </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="hero-showcase"
          >
            <div className="hero-person-frame">
              <Image src="/assets/leadership-cover.png" alt="Gestora escolar a acompanhar a sua equipa" fill sizes="(max-width: 900px) 100vw, 44vw" priority />
              <div className="hero-person-caption"><span>Uma visão para cada decisão</span><strong>KLASSE para a escola inteira</strong></div>
            </div>
            <div className="hero-product-window" aria-label="Pré-visualização do dashboard KLASSE">
              <div className="hero-window-bar"><span className="window-dots"><i /><i /><i /></span><span>app.klasse.ao</span><span className="window-live"><b />Ao vivo</span></div>
              <div className="hero-real-screen"><Image src="/assets/dashboard-notebook.png" alt="Dashboard real do KLASSE" fill sizes="(max-width: 900px) 100vw, 48vw" /></div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
