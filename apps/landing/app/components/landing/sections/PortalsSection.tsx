import type { ReactElement } from 'react'

import { portalHighlights, portals } from '../../../data/landing'

const portalIcons: Record<string, ReactElement> = {
  director: (
    <svg viewBox="0 0 24 24">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  secretaria: (
    <svg viewBox="0 0 24 24">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  professor: (
    <svg viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  financeiro: (
    <svg viewBox="0 0 24 24">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  aluno: (
    <svg viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
}

const portalIconStyles: Record<string, { background: string; border: string; color: string }> = {
  director: { background: '#2B6044', border: 'rgba(43,96,68,0.35)', color: '#F5F0E8' },
  secretaria: { background: '#1d4430', border: 'rgba(29,68,48,0.35)', color: '#F5F0E8' },
  financeiro: { background: '#C8902A', border: 'rgba(200,144,42,0.4)', color: '#1a1a1a' },
  professor: { background: '#2B6044', border: 'rgba(43,96,68,0.35)', color: '#F5F0E8' },
  aluno: { background: '#F5F0E8', border: 'rgba(43,96,68,0.2)', color: '#1d4430' },
}

export function PortalsSection() {
  const topPortals = portals.filter((portal) => ['director', 'secretaria', 'financeiro'].includes(portal.id))

  return (
    <section className="portais reveal section-accent" id="portais">
      <div className="container">
        <div style={{ maxWidth: 520, marginBottom: 56 }}>
          <div className="sec-label">O sistema</div>
          <h2 className="sec-h">Um portal para cada pessoa na escola</h2>
          <p className="sec-p" style={{ marginTop: 12 }}>
            Cada utilizador vê só o que precisa. A secretária não vê as notas. O professor não vê as finanças. O
            director vê tudo.
          </p>
        </div>
        <div className="portais-top">
          {topPortals.map((portal) => (
            <div key={portal.id} className="portal-card-compact">
              <div
                className="portal-icon"
                style={{
                  background: portalIconStyles[portal.id]?.background,
                  borderColor: portalIconStyles[portal.id]?.border,
                  color: portalIconStyles[portal.id]?.color,
                }}
              >
                {portalIcons[portal.id]}
              </div>
              <h3 className="portal-title">{portal.title}</h3>
              <p className="portal-desc">{portal.description}</p>
            </div>
          ))}
        </div>

        <div className="portais-bottom">
          <div className="portal-card-destaque portal-card-professor">
            <div className="portal-icon portal-icon-inline" style={{ background: '#2B6044', color: '#F5F0E8' }}>
              {portalIcons.professor}
            </div>
            <h3 className="portal-highlight-title">
              O professor lança.
              <br />
              O director vê <em>na hora</em>.
            </h3>
            <p className="portal-highlight-desc">{portalHighlights.professor.description}</p>
            <div className="portal-highlight-list">
              {portalHighlights.professor.features.map((feature) => (
                <div key={feature.title} className="portal-highlight-item">
                  <span className="portal-highlight-dot" />
                  <div>
                    <div className="portal-highlight-item-title">{feature.title}</div>
                    <div className="portal-highlight-item-desc">{feature.description}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="portal-mobile-badge">Optimizado para telemóvel</div>
          </div>

          <div className="portal-card-destaque portal-card-aluno">
            <div className="portal-icon portal-icon-inline" style={{ background: '#F5F0E8', color: '#1d4430' }}>
              {portalIcons.aluno}
            </div>
            <h3 className="portal-highlight-title portal-highlight-title-light">
              O aluno acompanha
              <br />
              o seu próprio <em>percurso</em>.
            </h3>
            <p className="portal-highlight-desc portal-highlight-desc-light">{portalHighlights.aluno.description}</p>
            <div className="portal-highlight-list">
              {portalHighlights.aluno.features.map((feature) => (
                <div key={feature.title} className="portal-highlight-item">
                  <span className="portal-highlight-dot" />
                  <div>
                    <div className="portal-highlight-item-title portal-highlight-item-title-light">{feature.title}</div>
                    <div className="portal-highlight-item-desc portal-highlight-item-desc-light">
                      {feature.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="portal-login-hint">
              <div className="portal-login-label">{portalHighlights.aluno.loginHint.label}</div>
              <div className="portal-login-code">{portalHighlights.aluno.loginHint.code}</div>
              <div className="portal-login-sub">{portalHighlights.aluno.loginHint.sub}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
