import { portalHighlights } from '../../../data/landing'

export function PortalsHighlightSection() {
  return (
    <section className="portais reveal">
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: 520, margin: '0 auto 64px' }}>
          <div className="sec-eyebrow" style={{ justifyContent: 'center' }}>
            Cinco portais. Um sistema.
          </div>
          <h2 className="sec-h" style={{ textAlign: 'center' }}>
            Cada pessoa na escola
            <br />
            tem o seu <em>próprio espaço</em>
          </h2>
          <p className="sec-p" style={{ margin: '0 auto' }}>
            Do director ao aluno — cada portal tem exactamente o que cada pessoa precisa de ver e fazer.
          </p>
        </div>

        <div className="portais-destaque">
          <div className="pd-card pd-professor">
            <div className="pd-badge">{portalHighlights.professor.badge}</div>
            <div className="pd-photo" aria-hidden="true">
              <div className="pd-photo-label">Foto do professor</div>
            </div>
            <h3 className="pd-title">
              {portalHighlights.professor.title[0]}
              <br />
              O director vê <em>na hora</em>.
            </h3>
            <p className="pd-desc">{portalHighlights.professor.description}</p>
            <div className="pd-features">
              {portalHighlights.professor.features.map((feature, index) => (
                <div key={feature.title} className="pd-feat">
                  <div className="pd-feat-icon">
                    {index === 0 && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    )}
                    {index === 1 && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                    )}
                    {index === 2 && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="pd-feat-title">{feature.title}</div>
                    <p className="pd-feat-desc">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="pd-mobile-hint">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
              {portalHighlights.professor.hint}
            </div>
          </div>

          <div className="pd-card pd-aluno">
            <div className="pd-badge pd-badge-aluno">{portalHighlights.aluno.badge}</div>
            <div className="pd-photo" aria-hidden="true">
              <div className="pd-photo-label">Foto do aluno</div>
            </div>
            <h3 className="pd-title">
              {portalHighlights.aluno.title[0]}
              <br />
              o seu próprio <em>percurso</em>.
            </h3>
            <p className="pd-desc">{portalHighlights.aluno.description}</p>
            <div className="pd-features">
              {portalHighlights.aluno.features.map((feature, index) => (
                <div key={feature.title} className="pd-feat">
                  <div className="pd-feat-icon pd-feat-icon-aluno">
                    {index === 0 && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    )}
                    {index === 1 && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    )}
                    {index === 2 && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="4" width="22" height="16" rx="2" />
                        <line x1="1" y1="10" x2="23" y2="10" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="pd-feat-title">{feature.title}</div>
                    <p className="pd-feat-desc">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="pd-login-hint">
              <div className="pd-login-label">{portalHighlights.aluno.loginHint.label}</div>
              <div className="pd-login-code">{portalHighlights.aluno.loginHint.code}</div>
              <div className="pd-login-sub">{portalHighlights.aluno.loginHint.sub}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
