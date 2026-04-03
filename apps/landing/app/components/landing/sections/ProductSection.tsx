'use client'

import {
  Users,
  Wallet,
  BookOpen,
  ClipboardCheck,
  CalendarCheck,
  BarChart3,
} from 'lucide-react'

export function ProductSection() {
  const features = [
    {
      title: 'Fecho de caixa cego',
      description:
        'O operador declara valores antes de ver o sistema, reduzindo fraude e aumentando controlo financeiro.',
      icon: Wallet,
    },
    {
      title: 'Documentos em lote',
      description:
        'Declarações e documentos emitidos em segundos, eliminando filas na secretaria.',
      icon: BookOpen,
    },
    {
      title: 'Admissões em massa',
      description:
        'Matrículas e rematrículas para várias turmas sem retrabalho.',
      icon: Users,
    },
    {
      title: 'Radar de atrasos',
      description:
        'Identifique rapidamente quem está em dívida e aja com prioridade.',
      icon: CalendarCheck,
    },
    {
      title: 'Professor no telemóvel',
      description:
        'Notas e presenças lançadas no fluxo do dia-a-dia, sem fricção.',
      icon: ClipboardCheck,
    },
    {
      title: 'Portal com contexto real',
      description:
        'Pais veem notas e situação financeira no mesmo lugar.',
      icon: BarChart3,
    },
  ]

  return (
    <section className="features z reveal section-bg section-bg-product section-accent" id="produto">
      <div className="container">
        <div className="product-intro product-intro--slide">
          <div className="sec-eyebrow">O produto</div>
          <h2 className="sec-title product-title-main">Funcionalidades para operar a escola com controlo.</h2>
          <p className="sec-sub">Do balcao ao financeiro, tudo integrado numa so plataforma.</p>
        </div>

        <div className="product-showcase-grid">
          {features.map((feature, index) => {
            const Icon = feature.icon
            const iconVariant = index % 2 === 0 ? 'product-showcase-icon--green' : 'product-showcase-icon--gold'

            return (
              <article
                key={feature.title}
                className="product-showcase-item"
              >
                <div className={`product-showcase-icon ${iconVariant}`}>
                  <Icon aria-hidden="true" />
                </div>
                <h3 className="product-showcase-title">{feature.title}</h3>
                <p className="product-showcase-desc">{feature.description}</p>
                <span className="product-showcase-accent" />
              </article>
            )
          })}
        </div>

        <div className="product-highlight-row">
          <div className="product-highlight-card">
            <h3>Conciliacao bancaria assistida</h3>
            <p>Upload e matching automatico para fechar o ciclo financeiro com menos erro manual.</p>
          </div>
          <div className="product-highlight-card">
            <h3>Relatorios para a direcao</h3>
            <p>Visao diaria do academico e financeiro para decisoes rapidas.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
