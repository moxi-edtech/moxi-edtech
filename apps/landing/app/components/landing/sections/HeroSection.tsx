interface HeroSectionProps {
  titleLines: string[]
  eyebrow: string
  subtitle: string
  primaryCta: { label: string; href: string }
  secondaryCta: { label: string; href: string }
  note: string
  mockup: {
    stats: Array<{ value: string; label: string; tone: 'green' | 'gold' | 'default' }>
    rows: Array<{ name: string; status: string; statusTone: 'ok' | 'pen' | 'late' }>
    floatingBadges: Array<{ label: string; value: string; sub: string; tone?: 'green' }>
  }
}

export function HeroSection({ titleLines, eyebrow, subtitle, primaryCta, secondaryCta, note, mockup }: HeroSectionProps) {
  return (
    <section className="hero z section-accent">
      <div className="container">
        <div className="hero-grid">
          <div>
            <div className="hero-eyebrow">{eyebrow}</div>
            <h1>
              {titleLines.map((line, index) => (
                <span key={line}>
                  {line}
                  {index < titleLines.length - 1 && <br />}
                </span>
              ))}
            </h1>
            <p className="hero-sub">{subtitle}</p>
            <div className="hero-ctas">
              <a href={primaryCta.href} className="btn-p">
                {primaryCta.label}
              </a>
              <a href={secondaryCta.href} className="btn-s">
                {secondaryCta.label}
              </a>
            </div>
            <div className="hero-proof">
              <div className="proof-text">
                <strong>{note}</strong>
              </div>
            </div>
          </div>
          <div className="hero-right">
            <div className="mockup-wrap">
              <div className="float-badge float-badge-1">
                <div className="fb-label">{mockup.floatingBadges[0].label}</div>
                <div className={`fb-value${mockup.floatingBadges[0].tone === 'green' ? ' green' : ''}`}>
                  {mockup.floatingBadges[0].value}
                </div>
                <div className="fb-sub">{mockup.floatingBadges[0].sub}</div>
              </div>
              <div className="float-badge float-badge-2">
                <div className="fb-label">{mockup.floatingBadges[1].label}</div>
                <div className="fb-value">{mockup.floatingBadges[1].value}</div>
                <div className="fb-sub">{mockup.floatingBadges[1].sub}</div>
              </div>
              <div className="mockup">
                <div className="mockup-bar">
                  <div className="m-dots">
                    <span className="md1"></span>
                    <span className="md2"></span>
                    <span className="md3"></span>
                  </div>
                  <span className="m-title">Portal do Director</span>
                </div>
                <div className="mockup-body">
                  <div className="m-stat-row">
                    {mockup.stats.map((stat) => (
                      <div key={stat.label} className="m-stat">
                        <div
                          className={`m-stat-num${
                            stat.tone === 'green' ? ' green' : stat.tone === 'gold' ? ' gold' : ''
                          }`}
                        >
                          {stat.value}
                        </div>
                        <div className="m-stat-label">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="m-alert">
                    <div className="m-alert-dot"></div>
                    <div className="m-alert-text">Sistema operacional</div>
                  </div>
                  <div className="m-list">
                    {mockup.rows.map((row) => (
                      <div key={row.name} className="m-row">
                        <span className="m-row-name">{row.name}</span>
                        <span
                          className={`m-row-badge ${
                            row.statusTone === 'ok'
                              ? 'badge-ok'
                              : row.statusTone === 'pen'
                              ? 'badge-pen'
                              : 'badge-late'
                          }`}
                        >
                          {row.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
