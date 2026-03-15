'use client'

import { useEffect, useState } from 'react'

const VAGAS_MIN = 3
const VAGAS_START = 7

const NUMBERS_DATA = [
  { value: 47, suffix: '+' },
  { value: 12, suffix: 'k' },
  { value: 98, suffix: '%' },
  { value: 3, suffix: 'h' },
]

export default function Page() {
  const [activeTab, setActiveTab] = useState<'financeiro' | 'secretaria' | 'academico' | 'director'>(
    'financeiro'
  )
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [vagas, setVagas] = useState(VAGAS_START)
  const [vagasPulse, setVagasPulse] = useState(false)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klasse.ao'

  useEffect(() => {
    const handleScroll = () => {
      const navbar = document.getElementById('navbar')
      if (navbar) {
        navbar.classList.toggle('scrolled', window.scrollY > 50)
      }
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )

    document.querySelectorAll('.reveal').forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const numGrid = document.querySelector('.num-grid')
    if (!numGrid) return

    const animateNum = (element: Element, target: number, suffix: string) => {
      let current = 0
      const step = target / 60
      const timer = window.setInterval(() => {
        current += step
        if (current >= target) {
          current = target
          window.clearInterval(timer)
        }
        const value = Math.floor(current)
        ;(element as HTMLElement).innerHTML = `${value}<span class="suffix">${suffix}</span>`
      }, 25)
    }

    const numObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const cards = (entry.target as HTMLElement).querySelectorAll('.num-card')
          cards.forEach((card, index) => {
            const valueElement = card.querySelector('.num-val')
            const data = NUMBERS_DATA[index]
            if (valueElement && data) {
              animateNum(valueElement, data.value, data.suffix)
            }
          })
          numObserver.unobserve(entry.target)
        })
      },
      { threshold: 0.3 }
    )

    numObserver.observe(numGrid)
    return () => numObserver.disconnect()
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setVagas((current) => {
        if (current <= VAGAS_MIN) return current
        if (Math.random() >= 0.15) return current
        setVagasPulse(true)
        window.setTimeout(() => setVagasPulse(false), 800)
        return current - 1
      })
    }, 45000)

    return () => window.clearInterval(interval)
  }, [])

  const toggleMenu = () => setIsMenuOpen((prev) => !prev)
  const closeMenu = () => setIsMenuOpen(false)

  return (
    <>
      <div className="ubar z">
        <div className="container">
          <p>
            🎓 Oferta de lançamento — <strong>2 meses grátis</strong> no plano anual
            <span className="ubar-badge">
              Apenas{' '}
              <span id="vagas-count" style={vagasPulse ? { color: '#f87171' } : undefined}>
                {vagas}
              </span>{' '}
              vagas restantes
            </span>
          </p>
        </div>
      </div>

      <nav id="navbar">
        <div className="container">
          <div className="nav-inner">
            <a href="#" className="nav-logo z">
              KLASSE<span>.</span>
            </a>
            <div className="nav-links z">
              <a href="#features">Funcionalidades</a>
              <a href="#depoimentos">Depoimentos</a>
              <a href="#precos">Preços</a>
              <a href="#faq">FAQ</a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="z">
              <a href={`${appUrl}/login`} className="btn-s" style={{ padding: '8px 18px', fontSize: 13 }}>
                Entrar
              </a>
              <a href="#precos" className="nav-cta">
                Começar agora
              </a>
              <button className="hamburger" onClick={toggleMenu} aria-label="Menu" type="button">
                <span></span>
                <span></span>
                <span></span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className={`mobile-menu${isMenuOpen ? ' open' : ''}`} id="mobileMenu">
        <button className="close-btn" onClick={toggleMenu} type="button">
          ×
        </button>
        <a href="#features" onClick={closeMenu}>
          Funcionalidades
        </a>
        <a href="#depoimentos" onClick={closeMenu}>
          Depoimentos
        </a>
        <a href="#precos" onClick={closeMenu}>
          Preços
        </a>
        <a href="#faq" onClick={closeMenu}>
          FAQ
        </a>
        <a href="#precos" className="btn-p" onClick={closeMenu}>
          Começar agora →
        </a>
      </div>

      <section className="hero z">
        <div className="container">
          <div className="hero-grid">
            <div>
              <div className="hero-eyebrow">Plataforma de gestão escolar · Angola</div>
              <h1>
                A escola que você
                <br />
                gere <em>merece</em>
                <br />
                um sistema <span className="gold">à altura</span>
              </h1>
              <p className="hero-sub">
                Chega de cadernos, Excel e WhatsApp para gerir propinas, alunos e documentos. O KLASSE é o sistema de
                gestão escolar feito <strong>para a realidade angolana</strong>.
              </p>
              <div className="hero-ctas">
                <a href="#precos" className="btn-p">
                  Experimentar 30 dias grátis →
                </a>
                <a href="#features" className="btn-s">
                  Ver como funciona
                </a>
              </div>
              <div className="hero-proof">
                <div className="avatars">
                  <div className="av av1">JM</div>
                  <div className="av av2">AL</div>
                  <div className="av av3">CP</div>
                  <div className="av av4">RS</div>
                  <div className="av av5">+</div>
                </div>
                <div className="proof-text">
                  <strong>47 escolas já usam o KLASSE</strong>
                  <span className="stars">★★★★★</span> 4.9 de satisfação média
                </div>
              </div>
            </div>
            <div className="hero-right">
              <div className="mockup-wrap">
                <div className="float-badge float-badge-1">
                  <div className="fb-label">Propinas cobradas</div>
                  <div className="fb-value green">Kz 4.2M</div>
                  <div className="fb-sub">Este mês · +18% vs anterior</div>
                </div>
                <div className="float-badge float-badge-2">
                  <div className="fb-label">Alunos activos</div>
                  <div className="fb-value">583</div>
                  <div className="fb-sub">3 turmas novas este trimestre</div>
                </div>
                <div className="mockup">
                  <div className="mockup-bar">
                    <div className="m-dots">
                      <span className="md1"></span>
                      <span className="md2"></span>
                      <span className="md3"></span>
                    </div>
                    <span className="m-title">KLASSE — Portal do Director</span>
                  </div>
                  <div className="mockup-body">
                    <div className="m-stat-row">
                      <div className="m-stat">
                        <div className="m-stat-num green">583</div>
                        <div className="m-stat-label">Alunos</div>
                      </div>
                      <div className="m-stat">
                        <div className="m-stat-num gold">Kz 4.2M</div>
                        <div className="m-stat-label">Cobrado</div>
                      </div>
                      <div className="m-stat">
                        <div className="m-stat-num">24</div>
                        <div className="m-stat-label">Turmas</div>
                      </div>
                    </div>
                    <div className="m-alert">
                      <div className="m-alert-dot"></div>
                      <div className="m-alert-text">Sistema operacional · Tudo em ordem</div>
                    </div>
                    <div className="m-list">
                      <div className="m-row">
                        <span className="m-row-name">João Manuel · 10ª TI-A</span>
                        <span className="m-row-badge badge-ok">Pago</span>
                      </div>
                      <div className="m-row">
                        <span className="m-row-name">Maria Antónia · 9ª ESG-B</span>
                        <span className="m-row-badge badge-pen">Pendente</span>
                      </div>
                      <div className="m-row">
                        <span className="m-row-name">Pedro Afonso · 6ª EP-C</span>
                        <span className="m-row-badge badge-ok">Pago</span>
                      </div>
                      <div className="m-row">
                        <span className="m-row-name">Ana Silva · 11ª CFB-A</span>
                        <span className="m-row-badge badge-late">Atraso</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="logos-section z">
        <div className="container">
          <p className="logos-label">Escolas que já confiam no KLASSE</p>
          <div className="logos-grid">
            <span className="logo-item">Colégio São João</span>
            <span className="logo-item">Instituto Técnico Luanda</span>
            <span className="logo-item">Escola Nova Era</span>
            <span className="logo-item">Colégio Santa Maria</span>
            <span className="logo-item">Centro Educativo Viana</span>
          </div>
        </div>
      </div>

      <section className="problema z reveal" id="problema">
        <div className="container">
          <div className="sec-eyebrow">O problema real</div>
          <h2 className="sec-title">
            Gerir uma escola em Angola
            <br />
            ainda é <em>demasiado difícil</em>
          </h2>
          <p className="sec-sub">Propinas perdidas, documentos atrasados, secretárias sobrecarregadas. Reconhece?</p>
          <div className="problema-grid">
            <div className="prob-card">
              <div className="prob-icon">📋</div>
              <div className="prob-title">Controlo de propinas no Excel ou em papel</div>
              <p className="prob-desc">
                Erros de cálculo, pagamentos perdidos, encarregados que juram que pagaram. Impossível saber quem deve o
                quê sem passar horas a rever.
              </p>
              <div className="prob-impact">⚠ Perda média de Kz 800.000/ano em propinas não cobradas</div>
            </div>
            <div className="prob-card">
              <div className="prob-icon">📄</div>
              <div className="prob-title">Documentos do MED demoram dias a preparar</div>
              <p className="prob-desc">
                Declarações de frequência, pautas, fichas de inscrição — tudo preenchido à mão, um por um. A secretária
                perde meio dia para 20 declarações.
              </p>
              <div className="prob-impact">⚠ 3-4 horas por semana só em documentação</div>
            </div>
            <div className="prob-card">
              <div className="prob-icon">👥</div>
              <div className="prob-title">Não sabe o estado real da escola em tempo real</div>
              <p className="prob-desc">
                Quantos alunos estão em atraso? Qual turma tem mais faltas? O director só descobre quando a secretária
                faz o relatório — se fizer.
              </p>
              <div className="prob-impact">⚠ Decisões tomadas com informação desactualizada</div>
            </div>
            <div className="prob-card">
              <div className="prob-icon">📱</div>
              <div className="prob-title">Comunicação com encarregados pelo WhatsApp pessoal</div>
              <p className="prob-desc">
                Avisos de propinas, convocatórias, resultados — tudo misturado no WhatsApp da secretária. Profissional
                não é. Rastreável também não.
              </p>
              <div className="prob-impact">⚠ Sem registo, sem histórico, sem controlo</div>
            </div>
          </div>
        </div>
      </section>

      <section className="features z reveal" id="features">
        <div className="container">
          <div className="features-header">
            <div className="sec-eyebrow" style={{ justifyContent: 'center' }}>
              A solução
            </div>
            <h2 className="sec-title" style={{ textAlign: 'center' }}>
              Tudo o que a sua escola precisa,
              <br />
              <em>num só lugar</em>
            </h2>
          </div>
          <div className="feat-tabs">
            <button
              className={`feat-tab${activeTab === 'financeiro' ? ' active' : ''}`}
              onClick={() => setActiveTab('financeiro')}
              type="button"
            >
              💰 Financeiro
            </button>
            <button
              className={`feat-tab${activeTab === 'secretaria' ? ' active' : ''}`}
              onClick={() => setActiveTab('secretaria')}
              type="button"
            >
              📋 Secretaria
            </button>
            <button
              className={`feat-tab${activeTab === 'academico' ? ' active' : ''}`}
              onClick={() => setActiveTab('academico')}
              type="button"
            >
              🎓 Académico
            </button>
            <button
              className={`feat-tab${activeTab === 'director' ? ' active' : ''}`}
              onClick={() => setActiveTab('director')}
              type="button"
            >
              📊 Director
            </button>
          </div>

          <div className={`feat-panel${activeTab === 'financeiro' ? ' active' : ''}`} id="tab-financeiro">
            <div className="feat-list">
              <div className="feat-item">
                <div className="feat-check">✓</div>
                <div className="feat-text">
                  <h4>Controlo de propinas em tempo real</h4>
                  <p>Sabe exactamente quem pagou, quem está em atraso e quanto falta cobrar — sem Excel, sem papel.</p>
                </div>
              </div>
              <div className="feat-item">
                <div className="feat-check">✓</div>
                <div className="feat-text">
                  <h4>Recibos e guias automáticos</h4>
                  <p>O sistema gera os documentos de pagamento automaticamente. A secretária só precisa de imprimir ou enviar.</p>
                </div>
              </div>
              <div className="feat-item">
                <div className="feat-check">✓</div>
                <div className="feat-text">
                  <h4>Alertas de cobranças em atraso</h4>
                  <p>O sistema identifica os alunos em atraso e pode notificar os encarregados automaticamente.</p>
                </div>
              </div>
              <div className="feat-item">
                <div className="feat-check">✓</div>
                <div className="feat-text">
                  <h4>Relatórios financeiros mensais</h4>
                  <p>Receita cobrada, por cobrar, por turma, por classe. Em segundos.</p>
                </div>
              </div>
            </div>
            <div className="feat-visual">
              <div className="fv-header">Propinas — Outubro 2026</div>
              <div className="fv-row">
                <span className="fv-name">João Manuel — 10ª TI-A</span>
                <span className="fv-val ok">Kz 15.000 ✓</span>
              </div>
              <div className="fv-row">
                <span className="fv-name">Maria Antónia — 9ª ESG-B</span>
                <span className="fv-val warn">Pendente</span>
              </div>
              <div className="fv-row">
                <span className="fv-name">Pedro Afonso — 6ª EP-C</span>
                <span className="fv-val ok">Kz 7.000 ✓</span>
              </div>
              <div className="fv-row">
                <span className="fv-name">Ana Silva — 11ª CFB-A</span>
                <span className="fv-val late">35 dias atraso</span>
              </div>
              <div className="fv-row">
                <span className="fv-name">Carlos Neto — 8ª ESG-A</span>
                <span className="fv-val ok">Kz 9.000 ✓</span>
              </div>
              <div className="fv-total">
                <span>Total cobrado este mês</span>
                <strong>Kz 4.2M</strong>
              </div>
            </div>
          </div>

          <div className={`feat-panel${activeTab === 'secretaria' ? ' active' : ''}`} id="tab-secretaria">
            <div className="feat-list">
              <div className="feat-item">
                <div className="feat-check">✓</div>
                <div className="feat-text">
                  <h4>Documentos MED em segundos</h4>
                  <p>Declarações de frequência, fichas de inscrição, pautas — gerados automaticamente com os dados já no sistema.</p>
                </div>
              </div>
              <div className="feat-item">
                <div className="feat-check">✓</div>
                <div className="feat-text">
                  <h4>Matrícula digital simplificada</h4>
                  <p>Registo de novos alunos, importação em massa via Excel, atribuição de turmas. Tudo num só fluxo.</p>
                </div>
              </div>
              <div className="feat-item">
                <div className="feat-check">✓</div>
                <div className="feat-text">
                  <h4>Balcão de atendimento inteligente</h4>
                  <p>Pesquisa rápida de alunos, histórico completo, registo de pagamentos — tudo na mesma janela.</p>
                </div>
              </div>
              <div className="feat-item">
                <div className="feat-check">✓</div>
                <div className="feat-text">
                  <h4>Controlo de acesso ao portal dos alunos</h4>
                  <p>A secretária liberta e revoga acessos ao portal do aluno com um clique.</p>
                </div>
              </div>
            </div>
            <div className="feat-visual">
              <div className="fv-header">Balcão de Atendimento</div>
              <div className="fv-row">
                <span className="fv-name">🔍 João Manuel da Silva</span>
                <span className="fv-val" style={{ fontSize: 11, color: 'var(--t3)' }}>
                  CSJ-00234
                </span>
              </div>
              <div className="fv-row">
                <span className="fv-name">Turma</span>
                <span className="fv-val">TI-10-M-A</span>
              </div>
              <div className="fv-row">
                <span className="fv-name">Estado matrícula</span>
                <span className="fv-val ok">Activa</span>
              </div>
              <div className="fv-row">
                <span className="fv-name">Propina Outubro</span>
                <span className="fv-val ok">Paga · 05/10</span>
              </div>
              <div className="fv-row">
                <span className="fv-name">Acesso portal</span>
                <span className="fv-val ok">Activo</span>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <div
                  style={{
                    flex: 1,
                    background: 'var(--g)',
                    borderRadius: 7,
                    padding: 8,
                    textAlign: 'center',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Registar pagamento
                </div>
                <div
                  style={{
                    flex: 1,
                    background: 'var(--s3)',
                    border: '1px solid var(--bd)',
                    borderRadius: 7,
                    padding: 8,
                    textAlign: 'center',
                    fontSize: 12,
                    color: 'var(--t2)',
                    cursor: 'pointer',
                  }}
                >
                  Emitir declaração
                </div>
              </div>
            </div>
          </div>

          <div className={`feat-panel${activeTab === 'academico' ? ' active' : ''}`} id="tab-academico">
            <div className="feat-list">
              <div className="feat-item">
                <div className="feat-check">✓</div>
                <div className="feat-text">
                  <h4>Gestão de turmas e horários</h4>
                  <p>Criação de turmas, atribuição de professores, gestão de horários — tudo estruturado e sem conflitos.</p>
                </div>
              </div>
              <div className="feat-item">
                <div className="feat-check">✓</div>
                <div className="feat-text">
                  <h4>Lançamento de notas pelos professores</h4>
                  <p>Os professores lançam notas directamente no sistema. O director vê em tempo real.</p>
                </div>
              </div>
              <div className="feat-item">
                <div className="feat-check">✓</div>
                <div className="feat-text">
                  <h4>Controlo de presenças</h4>
                  <p>Registo de presenças por aula, alertas automáticos quando o aluno está próximo do limite de faltas.</p>
                </div>
              </div>
              <div className="feat-item">
                <div className="feat-check">✓</div>
                <div className="feat-text">
                  <h4>Currículos alinhados ao MED</h4>
                  <p>Estrutura curricular pronta para os programas do MED angolano. Não começa do zero.</p>
                </div>
              </div>
            </div>
            <div className="feat-visual">
              <div className="fv-header">Turmas — Ano Lectivo 2026</div>
              <div className="fv-row">
                <span className="fv-name">TI-10-M-A · Informática</span>
                <span className="fv-val">35 alunos</span>
              </div>
              <div className="fv-row">
                <span className="fv-name">CFB-11-T-B · Ciências</span>
                <span className="fv-val">32 alunos</span>
              </div>
              <div className="fv-row">
                <span className="fv-name">EP-6-M-C · Primário</span>
                <span className="fv-val">40 alunos</span>
              </div>
              <div className="fv-row">
                <span className="fv-name">ESG-9-M-A · Secundário</span>
                <span className="fv-val">38 alunos</span>
              </div>
              <div className="fv-row">
                <span className="fv-name">TG-12-T-A · Gestão</span>
                <span className="fv-val warn">28 alunos</span>
              </div>
              <div className="fv-total">
                <span>Total de alunos</span>
                <strong style={{ color: 'var(--t1)' }}>583</strong>
              </div>
            </div>
          </div>

          <div className={`feat-panel${activeTab === 'director' ? ' active' : ''}`} id="tab-director">
            <div className="feat-list">
              <div className="feat-item">
                <div className="feat-check">✓</div>
                <div className="feat-text">
                  <h4>Dashboard de saúde da escola</h4>
                  <p>Uma visão clara do estado da escola — o que precisa da sua atenção, o que está em ordem, o próximo passo.</p>
                </div>
              </div>
              <div className="feat-item">
                <div className="feat-check">✓</div>
                <div className="feat-text">
                  <h4>Relatórios de desempenho</h4>
                  <p>Taxas de aprovação, assiduidade por turma, evolução financeira. Dados para tomar melhores decisões.</p>
                </div>
              </div>
              <div className="feat-item">
                <div className="feat-check">✓</div>
                <div className="feat-text">
                  <h4>Aprovação de turmas e matrículas</h4>
                  <p>Valide novas turmas, aprove matrículas especiais e gerencie excepções directamente no portal.</p>
                </div>
              </div>
              <div className="feat-item">
                <div className="feat-check">✓</div>
                <div className="feat-text">
                  <h4>Acesso em qualquer dispositivo</h4>
                  <p>Veja o estado da escola no telemóvel, tablet ou computador. A qualquer hora, em qualquer lugar.</p>
                </div>
              </div>
            </div>
            <div className="feat-visual">
              <div className="fv-header">Próximo passo — Portal do Director</div>
              <div
                style={{
                  background: 'rgba(31,107,59,.08)',
                  border: '1px solid var(--bdg)',
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 10,
                }}
              >
                <div style={{ fontSize: 12, color: 'var(--gl)', fontWeight: 600, marginBottom: 6 }}>✓ Sistema operacional</div>
                <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.5 }}>
                  A escola está <strong style={{ color: '#4ade80' }}>87% configurada</strong>. Falta validar 2 turmas para
                  ficarem prontas para matrículas.
                </div>
                <div
                  style={{
                    marginTop: 12,
                    background: 'var(--g)',
                    borderRadius: 7,
                    padding: '8px 12px',
                    textAlign: 'center',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Validar turmas agora →
                </div>
              </div>
              <div className="fv-row">
                <span className="fv-name">Alunos activos</span>
                <span className="fv-val ok">583</span>
              </div>
              <div className="fv-row">
                <span className="fv-name">Receita este mês</span>
                <span className="fv-val ok">Kz 4.2M</span>
              </div>
              <div className="fv-row">
                <span className="fv-name">Em atraso</span>
                <span className="fv-val warn">47 alunos</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="numeros z reveal">
        <div className="container">
          <div className="num-grid">
            <div className="num-card">
              <div className="num-val">
                47<span className="suffix">+</span>
              </div>
              <div className="num-label">Escolas activas<br />em Angola</div>
            </div>
            <div className="num-card">
              <div className="num-val">
                12<span className="suffix">k</span>
              </div>
              <div className="num-label">Alunos geridos<br />na plataforma</div>
            </div>
            <div className="num-card">
              <div className="num-val">
                98<span className="suffix">%</span>
              </div>
              <div className="num-label">Taxa de satisfação<br />das escolas</div>
            </div>
            <div className="num-card">
              <div className="num-val">
                3<span className="suffix">h</span>
              </div>
              <div className="num-label">Poupadas por semana<br />na secretaria</div>
            </div>
          </div>
        </div>
      </div>

      <section className="depoimentos z reveal" id="depoimentos">
        <div className="container">
          <div className="sec-eyebrow">Depoimentos reais</div>
          <h2 className="sec-title">
            O que dizem os directores
            <br />
            que já <em>usam o KLASSE</em>
          </h2>
          <div className="dep-grid">
            <div className="dep-card">
              <div className="dep-stars">★★★★★</div>
              <p className="dep-quote">
                Antes passava horas a tentar perceber quem tinha pago e quem não tinha. Agora abro o KLASSE e vejo tudo
                em segundos. <strong>Recuperei mais de Kz 1.2 milhões em propinas em atraso no primeiro trimestre.</strong>
              </p>
              <div className="dep-author">
                <div className="dep-av" style={{ background: 'linear-gradient(135deg,#1F6B3B,#4ade80)' }}>
                  JM
                </div>
                <div>
                  <div className="dep-name">João Manuel Correia</div>
                  <div className="dep-role">Director · Colégio São João, Luanda</div>
                </div>
              </div>
            </div>
            <div className="dep-card featured">
              <div className="dep-stars">★★★★★</div>
              <p className="dep-quote">
                A minha secretária demorava um dia inteiro a preparar as declarações de frequência para os exames.
                <strong>Agora faz tudo em menos de uma hora.</strong> O KLASSE mudou completamente o funcionamento da escola.
              </p>
              <div className="dep-author">
                <div className="dep-av" style={{ background: 'linear-gradient(135deg,#E3B23C,#f59e0b)' }}>
                  AL
                </div>
                <div>
                  <div className="dep-name">Ana Luísa Fernandes</div>
                  <div className="dep-role">Directora · Instituto Técnico Rangel</div>
                </div>
              </div>
            </div>
            <div className="dep-card">
              <div className="dep-stars">★★★★★</div>
              <p className="dep-quote">
                Tentei outros sistemas mas nenhum entendia a realidade angolana. O KLASSE tem os documentos do MED, as
                classes certas, o formato que as nossas escolas precisam. <strong>É feito para nós.</strong>
              </p>
              <div className="dep-author">
                <div className="dep-av" style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                  CP
                </div>
                <div>
                  <div className="dep-name">Carlos Pedro Neto</div>
                  <div className="dep-role">Director · Escola Nova Era, Viana</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="como z reveal">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 520, margin: '0 auto 0' }}>
            <div className="sec-eyebrow" style={{ justifyContent: 'center' }}>
              Processo simples
            </div>
            <h2 className="sec-title" style={{ textAlign: 'center' }}>
              Da inscrição à escola
              <br />
              <em>operacional em 48h</em>
            </h2>
          </div>
          <div className="steps">
            <div className="step-card">
              <div className="step-arrow">→</div>
              <div className="step-num">01</div>
              <div className="step-icon">📋</div>
              <div className="step-title">Preenche o formulário</div>
              <p className="step-desc">5 minutos para nos contar sobre a sua escola — classes, turnos, número de alunos.</p>
            </div>
            <div className="step-card">
              <div className="step-arrow">→</div>
              <div className="step-num">02</div>
              <div className="step-icon">⚙️</div>
              <div className="step-title">Configuramos tudo</div>
              <p className="step-desc">A equipa KLASSE configura a escola no sistema em menos de 24 horas.</p>
            </div>
            <div className="step-card">
              <div className="step-arrow">→</div>
              <div className="step-num">03</div>
              <div className="step-icon">👥</div>
              <div className="step-title">Importamos os alunos</div>
              <p className="step-desc">Enviamos o modelo Excel. Preenche com os dados dos alunos e importamos em minutos.</p>
            </div>
            <div className="step-card">
              <div className="step-num">04</div>
              <div className="step-icon">🚀</div>
              <div className="step-title">Escola operacional</div>
              <p className="step-desc">Secretaria a usar o sistema, director a ver o dashboard, propinas a ser controladas.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="oferta z reveal">
        <div className="container">
          <div className="oferta-inner">
            <div className="oferta-grid">
              <div>
                <div className="oferta-eyebrow">Oferta de lançamento</div>
                <h2>
                  Comece hoje com
                  <br />2 meses <em>completamente grátis</em>
                </h2>
                <p style={{ marginTop: 16 }}>
                  Escolas que aderem agora no plano anual pagam 10 meses e têm 12 meses de acesso. Sem letras pequenas,
                  sem surpresas.
                </p>
                <a href="#precos" className="btn-p" style={{ marginTop: 28, display: 'inline-flex' }}>
                  Ver planos e aderir →
                </a>
              </div>
              <div className="oferta-right">
                <div className="oferta-box">
                  <div className="oferta-box-title">O que está incluído</div>
                  <div className="oferta-items">
                    <div className="oferta-item">Configuração da escola incluída</div>
                    <div className="oferta-item">Importação dos alunos assistida</div>
                    <div className="oferta-item">Sessão de formação para a secretaria</div>
                    <div className="oferta-item">Suporte por email e chat</div>
                    <div className="oferta-item">Todos os documentos MED incluídos</div>
                  </div>
                </div>
                <div className="oferta-box">
                  <div className="oferta-box-title">Vagas disponíveis este mês</div>
                  <div className="progress-wrap">
                    <div className="progress-label">
                      <span>Vagas preenchidas</span>
                      <span id="vagasLabel">73% ocupadas</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill"></div>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8 }}>
                      Apenas <strong style={{ color: 'var(--gold)' }}>{vagas} vagas</strong> restantes para este mês
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="precos z reveal" id="precos">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 520, margin: '0 auto 0' }}>
            <div className="sec-eyebrow" style={{ justifyContent: 'center' }}>
              Planos transparentes
            </div>
            <h2 className="sec-title" style={{ textAlign: 'center' }}>
              Preços feitos para a
              <br />
              <em>realidade angolana</em>
            </h2>
            <p style={{ fontSize: 15, color: 'var(--t2)', marginTop: 12, fontWeight: 300 }}>
              Nenhuma funcionalidade bloqueada por plano. Os limites são de capacidade, não de acesso.
            </p>
          </div>
          <div className="precos-grid">
            <div className="preco-card">
              <div className="preco-badge pb-basic">Basic</div>
              <div className="preco-nome">Basic</div>
              <p className="preco-desc">Para colégios pequenos a iniciar a gestão digital.</p>
              <div className="preco-valor">
                <div className="preco-num">
                  <span className="kz">Kz</span>800.000
                </div>
                <div className="preco-per">por ano · faturado anualmente</div>
                <span className="preco-saving">Poupa Kz 160.000 vs mensal</span>
              </div>
              <div className="preco-sep"></div>
              <div className="preco-feats">
                <div className="preco-feat">
                  <span className="pf-icon">✓</span>Até 300 alunos
                </div>
                <div className="preco-feat">
                  <span className="pf-icon">✓</span>Portal Secretaria + Director
                </div>
                <div className="preco-feat">
                  <span className="pf-icon">✓</span>Documentos MED incluídos
                </div>
                <div className="preco-feat">
                  <span className="pf-icon">✓</span>Suporte email 48h
                </div>
                <div className="preco-feat">
                  <span className="pf-icon">✓</span>5 GB storage
                </div>
              </div>
              <a href="#" className="preco-cta cta-basic">
                Começar com Basic
              </a>
            </div>
            <div className="preco-card featured">
              <div className="preco-badge pb-pro">✦ Mais popular</div>
              <div className="preco-nome">Pro</div>
              <p className="preco-desc">Para escolas com múltiplas turmas e corpo docente.</p>
              <div className="preco-valor">
                <div className="preco-num">
                  <span className="kz">Kz</span>1.400.000
                </div>
                <div className="preco-per">por ano · faturado anualmente</div>
                <span className="preco-saving">Poupa Kz 280.000 vs mensal</span>
              </div>
              <div className="preco-sep"></div>
              <div className="preco-feats">
                <div className="preco-feat">
                  <span className="pf-icon">✓</span>Até 800 alunos
                </div>
                <div className="preco-feat">
                  <span className="pf-icon">✓</span>Todos os portais incluídos
                </div>
                <div className="preco-feat">
                  <span className="pf-icon">✓</span>Documentos MED incluídos
                </div>
                <div className="preco-feat">
                  <span className="pf-icon">✓</span>Suporte email 24h + chat
                </div>
                <div className="preco-feat">
                  <span className="pf-icon">✓</span>20 GB storage
                </div>
              </div>
              <a href="#" className="preco-cta cta-pro">
                Começar com Pro →
              </a>
            </div>
            <div className="preco-card">
              <div className="preco-badge pb-ent">Enterprise</div>
              <div className="preco-nome">Enterprise</div>
              <p className="preco-desc">Para grupos escolares e instituições com múltiplos campi.</p>
              <div className="preco-valor">
                <div className="preco-num" style={{ fontSize: 28, fontStyle: 'italic', color: 'var(--gold)' }}>
                  Negociado
                </div>
                <div className="preco-per">Proposta personalizada para a sua instituição</div>
              </div>
              <div className="preco-sep"></div>
              <div className="preco-feats">
                <div className="preco-feat">
                  <span className="pf-icon">✓</span>Alunos ilimitados
                </div>
                <div className="preco-feat">
                  <span className="pf-icon">✓</span>Todos os portais + API
                </div>
                <div className="preco-feat">
                  <span className="pf-icon">✓</span>Gestor de conta dedicado
                </div>
                <div className="preco-feat">
                  <span className="pf-icon">✓</span>SLA 99.9% uptime
                </div>
                <div className="preco-feat">
                  <span className="pf-icon">✓</span>100 GB+ storage
                </div>
              </div>
              <a href="#" className="preco-cta cta-ent">
                Falar com a equipa
              </a>
            </div>
          </div>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--t3)', marginTop: 24 }}>
            30 dias de teste grátis em qualquer plano. Sem cartão de crédito.
          </p>
        </div>
      </section>

      <section className="faq z reveal" id="faq">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto 0' }}>
            <div className="sec-eyebrow" style={{ justifyContent: 'center' }}>
              Perguntas frequentes
            </div>
            <h2 className="sec-title" style={{ textAlign: 'center' }}>
              Tem dúvidas?
              <br />
              <em>Nós respondemos</em>
            </h2>
          </div>
          <div className="faq-grid">
            <div className="faq-item">
              <div className="faq-q">O sistema funciona sem internet?</div>
              <p className="faq-a">
                O KLASSE é baseado na web e precisa de internet para funcionar. No entanto, foi optimizado para redes
                lentas — funciona bem mesmo com ligações 3G.
              </p>
            </div>
            <div className="faq-item">
              <div className="faq-q">E se já tiver os dados dos alunos noutro sistema?</div>
              <p className="faq-a">
                Fornecemos um modelo Excel para importação em massa. A equipa KLASSE acompanha o processo de migração
                <strong>sem custo adicional</strong>.
              </p>
            </div>
            <div className="faq-item">
              <div className="faq-q">A secretária precisa de formação técnica?</div>
              <p className="faq-a">
                Não. O KLASSE foi desenhado para secretárias sem experiência técnica. Fazemos uma sessão de formação de
                2 horas e ficam autónomas.
              </p>
            </div>
            <div className="faq-item">
              <div className="faq-q">Os documentos seguem o formato do MED angolano?</div>
              <p className="faq-a">
                Sim. Todos os documentos — declarações de frequência, pautas, fichas de inscrição — seguem
                <strong>exactamente o formato exigido pelo MED</strong>.
              </p>
            </div>
            <div className="faq-item">
              <div className="faq-q">Posso cancelar a qualquer momento?</div>
              <p className="faq-a">
                Sim. Sem penalizações. Se cancelar, tem 90 dias para exportar todos os dados da escola antes de o acesso
                ser encerrado.
              </p>
            </div>
            <div className="faq-item">
              <div className="faq-q">Os dados da escola estão seguros?</div>
              <p className="faq-a">
                Os dados são encriptados e armazenados em servidores seguros. Nunca partilhamos ou vendemos dados das
                escolas a terceiros.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="final-cta z reveal">
        <div className="container">
          <h2>
            A sua escola merece
            <br />
            trabalhar <em>melhor</em>
          </h2>
          <p>Junte-se às 47 escolas angolanas que já poupam tempo, cobram mais e trabalham com menos stress.</p>
          <div className="cta-group">
            <a href="#precos" className="btn-p" style={{ fontSize: 16, padding: '16px 32px' }}>
              Começar agora — 30 dias grátis →
            </a>
            <a href="#" className="btn-s">
              Agendar demonstração
            </a>
          </div>
          <p className="final-note">Sem cartão de crédito · Configuração assistida incluída · Cancele quando quiser</p>
        </div>
      </section>

      <footer className="z">
        <div className="container">
          <div className="footer-inner">
            <div className="footer-logo">
              KLASSE<span>.</span>
            </div>
            <div className="footer-links">
              <a href="#">Termos de Serviço</a>
              <a href="#">Política de Privacidade</a>
              <a href="#">Suporte</a>
              <a href="#">Contacto</a>
            </div>
            <div className="footer-copy">© 2026 KLASSE. Feito em Angola, para Angola.</div>
          </div>
        </div>
      </footer>
    </>
  )
}
