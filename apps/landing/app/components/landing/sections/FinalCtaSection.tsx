interface FinalCtaSectionProps {
  primaryCta: { label: string; href: string }
  secondaryCta: { label: string; href: string }
}

export function FinalCtaSection({ primaryCta, secondaryCta }: FinalCtaSectionProps) {
  return (
    <section className="final-cta z reveal section-accent" id="contacto">
      <div className="container">
        <h2>
          Vamos conversar sobre
          <br />
          a sua escola
        </h2>
        <p>Escolha o caminho mais simples para si. Nós tratamos do resto.</p>
        <div className="cta-group">
          <a href={primaryCta.href} className="btn-p" style={{ fontSize: 16, padding: '16px 32px' }}>
            {primaryCta.label}
          </a>
          <a href={secondaryCta.href} className="btn-s">
            {secondaryCta.label}
          </a>
        </div>
        <p className="final-note">Sem compromisso · Acompanhamento pessoal da equipa</p>
      </div>
    </section>
  )
}
