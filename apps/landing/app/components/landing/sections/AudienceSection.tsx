import { audienceCards } from '../../../data/landing'

export function AudienceSection() {
  return (
    <section className="problema z reveal section-bg section-bg-audience section-accent" id="para-quem">
      <div className="container">
        <div className="sec-eyebrow">Para quem é</div>
        <h2 className="sec-title">
          Diretores que querem
          <br />
          uma escola organizada de verdade
        </h2>
        <p className="sec-sub">
          Se a sua escola já cresceu e o Excel não aguenta mais, este sistema foi feito para si.
        </p>
        <div className="quote-block">
          Sem promessas artificiais — mostramos o sistema na sua escola antes de decidir.
        </div>
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
