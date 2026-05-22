'use client'

import { track } from '@vercel/analytics'

import { pilot } from '../../../data/landing'
import { FadeIn } from '../FadeIn'

interface PilotSectionProps {
  diagnosticCta: { label: string; href: string }
}

export function PilotSection({ diagnosticCta }: PilotSectionProps) {
  return (
    <section className="piloto section-accent">
      <div className="container">
        <FadeIn className="piloto-inner">
          <div className="piloto-badge">{pilot.badge}</div>
          <h2>{pilot.title}</h2>
          <p>{pilot.description}</p>
          <div className="piloto-actions">
            <a
              href={diagnosticCta.href}
              className="btn-s"
              onClick={() => track('conversion_click', { section: 'pilot', label: diagnosticCta.label })}
            >
              {diagnosticCta.label}
            </a>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
