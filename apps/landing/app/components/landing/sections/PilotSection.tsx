import { pilot } from '../../../data/landing'

export function PilotSection() {
  return (
    <section className="piloto section-accent">
      <div className="container">
        <div className="piloto-inner reveal">
          <div className="piloto-badge">{pilot.badge}</div>
          <h2>{pilot.title}</h2>
          <p>{pilot.description}</p>
        </div>
      </div>
    </section>
  )
}
