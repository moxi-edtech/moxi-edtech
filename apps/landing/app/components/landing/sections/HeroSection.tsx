'use client'

import { track } from '@vercel/analytics'
import { motion, Variants } from 'framer-motion'
import Image from 'next/image'

interface HeroSectionProps {
  titleLines: string[]
  eyebrow: string
  subtitle: string
  primaryCta: { label: string; href: string }
  note: string
}

export function HeroSection({ titleLines, eyebrow, subtitle, primaryCta, note }: HeroSectionProps) {
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
      <div className="hero-gradient-bg" aria-hidden="true" />
      <div className="hero-noise-bg" aria-hidden="true" />
      <div className="hero-contrast-overlay" aria-hidden="true" />
      <div className="container">
        <div className="hero-content">
          <motion.div
            className="hero-copy"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants} className="hero-eyebrow">
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
            </motion.div>
            <motion.div variants={itemVariants} className="hero-proof">
              <div className="proof-text">
                <strong>{note}</strong>
              </div>
            </motion.div>
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="hero-bg-image-wrapper"
          style={{ position: 'absolute', inset: 0, zIndex: -1 }}
        >
          <Image
            src="/diretor%20com%20terno.PNG"
            alt="Director de escola angolana com terno"
            fill
            sizes="100vw"
            priority
            className="hero-bg-image"
          />
        </motion.div>
      </div>
    </section>
  )
}
