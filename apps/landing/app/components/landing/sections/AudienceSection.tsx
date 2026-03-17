import { audienceCards } from '../../../data/landing'

export function AudienceSection() {
  return (
    <section className="problema z reveal section-bg section-bg-audience section-accent" id="para-quem">
      <div className="container">
        <div className="sec-eyebrow">Para quem é</div>
        <h2 className="sec-title">Reconhece alguma destas situações?</h2>
        <p className="sec-sub">Se a sua escola já cresceu e o Excel não aguenta mais, este sistema foi feito para si.</p>
        <div className="problema-grid">
          {audienceCards.map((card) => (
            <div key={card.title} className="prob-card">
              <h3 className="prob-title">{card.title}</h3>
              <p className="prob-desc">{card.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
