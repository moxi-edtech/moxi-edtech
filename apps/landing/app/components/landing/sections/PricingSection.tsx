import { pricingPlans } from '../../../data/landing'

interface PricingSectionProps {
  intro: string
  note: string
  appUrl: string
}

export function PricingSection({ intro, note, appUrl }: PricingSectionProps) {
  const normalizedAppUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl
  const resolveHref = (ctaHref: string) => {
    if (ctaHref.startsWith('http') || ctaHref.startsWith('#')) {
      return ctaHref
    }
    const normalizedCta = ctaHref.startsWith('/') ? ctaHref : `/${ctaHref}`
    return `${normalizedAppUrl}${normalizedCta}`
  }

  const variants = {
    basic: {
      card: 'pricing-card pricing-card--basic',
      badge: 'pricing-badge pricing-badge--basic',
      cta: 'pricing-cta pricing-cta--basic',
    },
    pro: {
      card: 'pricing-card pricing-card--pro',
      badge: 'pricing-badge pricing-badge--pro',
      cta: 'pricing-cta pricing-cta--pro',
    },
    enterprise: {
      card: 'pricing-card pricing-card--enterprise',
      badge: 'pricing-badge pricing-badge--enterprise',
      cta: 'pricing-cta pricing-cta--enterprise',
    },
  } as const

  const emphasized = new Set(['Todos os portais', 'Todos os portais + API', 'Suporte dedicado'])

  return (
    <section className="precos precos-dark z reveal section-accent" id="precos">
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: 520, margin: '0 auto 0' }}>
          <div className="sec-eyebrow" style={{ justifyContent: 'center' }}>
            Planos transparentes
          </div>
          <h2 className="sec-title" style={{ textAlign: 'center' }}>
            Preços feitos para a nossa
            <br />
            <em>realidade</em>
          </h2>
          <p className="precos-intro">{intro}</p>
        </div>
        <div className="precos-grid precos-grid-dark">
          {pricingPlans.map((plan) => {
            const variant = variants[plan.slug]
            const planHref = resolveHref(plan.ctaHref)
            const capacityValues = plan.slug === 'enterprise'
              ? { alunos: '∞', utilizadores: '∞', storage: '∞' }
              : plan.capacity

            return (
              <div
                key={plan.name}
                className={variant.card}
                role="link"
                tabIndex={0}
                onClick={() => {
                  window.location.href = planHref
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    window.location.href = planHref
                  }
                }}
              >
                <div className={variant.badge}>{plan.name}</div>
                <h3 className="pricing-name">{plan.name}</h3>
                <p className="pricing-desc">{plan.description}</p>

                <div className="pricing-price">
                  {plan.price ? (
                    <>
                      <div className="pricing-price-row">
                        <span className="pricing-price-prefix">Kz</span>
                        <span className="pricing-price-value">{plan.price}</span>
                      </div>
                      <div className="pricing-price-note">{plan.priceNote}</div>
                      {plan.saving && <div className="pricing-saving">{plan.saving}</div>}
                    </>
                  ) : (
                    <div className="pricing-price-custom">{plan.priceNote}</div>
                  )}
                </div>

                <div className="pricing-capacity">
                  <div>
                    <div className="pricing-capacity-value">{capacityValues.alunos}</div>
                    <div className="pricing-capacity-label">Alunos</div>
                  </div>
                  <div>
                    <div className="pricing-capacity-value">{capacityValues.utilizadores}</div>
                    <div className="pricing-capacity-label">Utilizadores</div>
                  </div>
                  <div>
                    <div className="pricing-capacity-value">{capacityValues.storage}</div>
                    <div className="pricing-capacity-label">Storage</div>
                  </div>
                </div>

                <div className="pricing-divider"></div>

                <div className="pricing-features">
                  {plan.features.map((feature) => (
                    <div key={feature} className={`pricing-feature${emphasized.has(feature) ? ' is-strong' : ''}`}>
                      <span className="pricing-dot" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <a href={planHref} className={variant.cta}>
                  {plan.cta}
                </a>

                {plan.featured && <div className="pricing-highlight" />}
              </div>
            )
          })}
        </div>
        <p className="precos-note">{note}</p>
      </div>
    </section>
  )
}
