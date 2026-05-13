'use client'

import { pilot } from '../../../data/landing'
import { FadeIn } from '../FadeIn'

export function PilotSection() {
  return (
    <section className="piloto section-accent">
      <div className="container">
        <FadeIn className="piloto-inner">
          <div className="piloto-badge">{pilot.badge}</div>
          <h2>{pilot.title}</h2>
          <p>{pilot.description}</p>
        </FadeIn>
      </div>
    </section>
  )
}
