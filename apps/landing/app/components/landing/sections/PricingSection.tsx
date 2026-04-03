import type { PricingPlan } from '../../../data/landing'

import { pricingPlans } from '../../../data/landing'

interface PricingSectionProps {
  intro: string
  note: string
  appUrl: string
}

interface PricingPanelProps extends PricingSectionProps {
  plan: PricingPlan
  showIntro?: boolean
  showNote?: boolean
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

const resolveHref = (appUrl: string, ctaHref: string) => {
  if (ctaHref.startsWith('http') || ctaHref.startsWith('#')) {
    return ctaHref
  }
  const normalizedAppUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl
  const normalizedCta = ctaHref.startsWith('/') ? ctaHref : `/${ctaHref}`
  return `${normalizedAppUrl}${normalizedCta}`
}

const resolveCapacity = (plan: PricingPlan) =>
  plan.slug === 'enterprise'
    ? { alunos: '∞', utilizadores: '∞', storage: '∞' }
    : plan.capacity

function PricingPlanCard({ plan, appUrl }: { plan: PricingPlan; appUrl: string }) {
  const variant = variants[plan.slug]
  const planHref = resolveHref(appUrl, plan.ctaHref)
  const capacityValues = resolveCapacity(plan)

  return (
    <div
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
}

function PricingIntro({ intro }: { intro: string }) {
  return (
    <div style={{ textAlign: 'center', maxWidth: 520, margin: '0 auto 0' }}>
      <div className="sec-eyebrow" style={{ justifyContent: 'center' }}>
        Planos transparentes
      </div>
      <h2 className="sec-title" style={{ textAlign: 'center' }}>
        Preços para a nossa realidade.
      </h2>
      <p className="precos-intro">{intro}</p>
    </div>
  )
}

export function PricingPanel({ plan, intro, note, appUrl, showIntro, showNote }: PricingPanelProps) {
  const sectionId = showIntro ? 'precos' : undefined
  const centerPanel = !showIntro
  return (
    <section
      className={`precos precos-dark z reveal section-accent${centerPanel ? ' precos--center' : ''}`}
      id={sectionId}
    >
      <div className="container">
        {showIntro && <PricingIntro intro={intro} />}
        <div className="precos-grid precos-grid-dark">
          <PricingPlanCard plan={plan} appUrl={appUrl} />
        </div>
        {showNote && <p className="precos-note">{note}</p>}
      </div>
    </section>
  )
}

export function PricingSection({ intro, note, appUrl }: PricingSectionProps) {
  return (
    <section className="precos precos-dark z reveal section-accent" id="precos">
      <div className="container">
        <PricingIntro intro={intro} />
        <div className="precos-grid precos-grid-dark">
          {pricingPlans.map((plan) => (
            <PricingPlanCard key={plan.name} plan={plan} appUrl={appUrl} />
          ))}
        </div>
        <p className="precos-note">{note}</p>
      </div>
    </section>
  )
}
