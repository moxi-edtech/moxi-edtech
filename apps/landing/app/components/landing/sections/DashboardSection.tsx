export function DashboardSection() {
  const bullets = [
    'Receita prevista vs. receita realizada',
    'Turmas e alunos com atraso prioritário',
    'Alertas operacionais e financeiros no mesmo painel',
    'Direção com contexto para decisão diária',
  ]

  return (
    <section className="dashboard section-accent reveal" id="dashboard">
      <div className="container dashboard-grid">
        <div className="dashboard-copy">
          <div className="sec-eyebrow">Painel de gestão</div>
          <h2 className="sec-title">
            O director ve <span>tudo</span> em tempo real.
          </h2>
          <p className="sec-sub">
            Do fecho de caixa ao risco de inadimplência, a direção acompanha a escola com dados acionáveis num único painel.
          </p>
          <div className="dashboard-bullets">
            {bullets.map((bullet) => (
              <div key={bullet} className="dashboard-bullet">
                <span className="dashboard-bullet-dot" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-visual" aria-label="Exemplo de dashboard KLASSE">
          <div className="dashboard-frame">
            <div className="dashboard-bar">
              <span />
              <span />
              <span />
            </div>
            <div className="dashboard-screen">
              <div className="dashboard-topbar">
                <div className="dashboard-topbar-context">
                  <p className="dashboard-topbar-title">Dashboard</p>
                  <p className="dashboard-topbar-sub">Portal da escola</p>
                </div>
                <div className="dashboard-topbar-search">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <line x1="16.65" y1="16.65" x2="21" y2="21" />
                  </svg>
                  <span>Pesquisar...</span>
                </div>
                <div className="dashboard-topbar-actions">
                  <span className="dashboard-topbar-chip">Diretor</span>
                  <span className="dashboard-topbar-bell" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </span>
                  <span className="dashboard-topbar-user">
                    <span className="dashboard-topbar-avatar">K</span>
                    <span className="dashboard-topbar-user-text">
                      <strong>Filomeno Kossy</strong>
                      <small>Colegio Nova Geracao</small>
                    </span>
                    <svg className="dashboard-topbar-chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </div>
              </div>

              <div className="dashboard-kpi-grid">
                <article className="dashboard-kpi dashboard-kpi--alunos">
                  <small>Alunos ativos</small>
                  <strong>583</strong>
                </article>
                <article className="dashboard-kpi dashboard-kpi--receita">
                  <small>Turmas</small>
                  <strong>24</strong>
                </article>
                <article className="dashboard-kpi dashboard-kpi--pendencias">
                  <small>Professores</small>
                  <strong>47</strong>
                </article>
                <article className="dashboard-kpi dashboard-kpi--financeiro">
                  <small>Financeiro</small>
                  <strong className="ok">78%</strong>
                </article>
              </div>

              <div className="dashboard-revenue">
                <div className="dashboard-revenue-row">
                  <span>Previsao de receita</span>
                  <strong>Kz 4.2M / Kz 5.4M</strong>
                </div>
                <div className="dashboard-revenue-track">
                  <i style={{ width: '78%' }} />
                </div>
                <p className="dashboard-revenue-note">78% realizado no periodo actual</p>
              </div>

              <div className="dashboard-mini-panel">
                <p className="dashboard-mini-title">Atencao prioritaria</p>
                <div className="dashboard-mini-row">
                  <span>Turma 8A</span>
                  <strong className="ok">Pago</strong>
                </div>
                <div className="dashboard-mini-row">
                  <span>Turma 9B</span>
                  <strong className="warn">2 propinas pendente</strong>
                </div>
                <div className="dashboard-mini-row">
                  <span>Turma 11A</span>
                  <strong className="late">3 alunos em atraso</strong>
                </div>
              </div>
            </div>
          </div>
          <div className="dashboard-neck" />
          <div className="dashboard-stand" />
          <div className="dashboard-base" />
        </div>
      </div>
    </section>
  )
}
