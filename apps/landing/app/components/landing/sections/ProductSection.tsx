import { productCards, productSteps } from '../../../data/landing'

export function ProductSection() {
  return (
    <section className="features z reveal section-bg section-bg-product section-accent" id="produto">
      <div className="container">
        <div className="product-intro">
          <div className="sec-eyebrow">O produto</div>
          <h2 className="sec-title product-title-main">Tudo o que a secretaria faz hoje, em segundos.</h2>
          <p className="sec-sub">
            O KLASSE resolve o dia-a-dia da secretaria e dá ao director uma visão clara do que está a acontecer.
          </p>
        </div>

        <div className="product-features">
          {productCards.map((card) => (
            <div key={card.title} className="product-feature">
              <h3 className="product-title">{card.title}</h3>
              <p className="product-desc">{card.description}</p>
            </div>
          ))}
        </div>

        <div className="product-steps">
          {productSteps.map((step, index) => (
            <div key={step.title} className="product-step">
              <div className="product-step-number">0{index + 1}</div>
              <div>
                <h3 className="product-step-title">{step.title}</h3>
                <p className="product-step-desc">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
