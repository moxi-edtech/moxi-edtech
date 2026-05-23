'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronRight, ChevronLeft, BarChart3, Clock, ShieldAlert, Zap, ArrowRight, MessageCircle, Share2, FileDown } from 'lucide-react'
import { Navbar } from '../components/landing/sections/Navbar'
import { FooterSection } from '../components/landing/sections/FooterSection'
import { MobileMenu } from '../components/landing/sections/MobileMenu'
import { footerLinks, navLinks } from '../data/landing'
import { jsPDF } from 'jspdf'

type Question = {
  id: string
  title: string
  options: {
    label: string
    value: string
    score: number
  }[]
}

const QUESTIONS: Question[] = [
  {
    id: 'matriculas',
    title: 'Como é feito o processo de matrículas no início do ano?',
    options: [
      { label: 'Papel e fichas físicas (muita fila)', value: 'papel', score: 1 },
      { label: 'Ficheiros Excel desorganizados', value: 'excel', score: 2 },
      { label: 'Sistema antigo que não ajuda muito', value: 'sistema-antigo', score: 3 },
      { label: 'Sistema moderno, mas ainda lento', value: 'sistema-moderno', score: 4 },
    ],
  },
  {
    id: 'financeiro',
    title: 'Quanto tempo demora para saber quem não pagou a propina do mês?',
    options: [
      { label: 'Não sei exatamente até ao fim do mês', value: 'nao-sei', score: 1 },
      { label: 'Demoro dias a conferir depósitos bancários', value: 'dias', score: 2 },
      { label: 'Tenho uma lista, mas é difícil de gerir', value: 'dificil', score: 3 },
      { label: 'Sei quase na hora, mas o processo é manual', value: 'manual', score: 4 },
    ],
  },
  {
    id: 'pautas',
    title: 'Como os professores entregam as notas no fim do trimestre?',
    options: [
      { label: 'Em papel (temos de digitar tudo na secretaria)', value: 'papel', score: 1 },
      { label: 'Mandam ficheiros Excel por pendrive/email', value: 'excel', score: 2 },
      { label: 'Lançam num sistema, mas dá muitos erros', value: 'sistema-erro', score: 3 },
      { label: 'Lançam online, mas demora a processar pautas', value: 'online', score: 4 },
    ],
  },
  {
    id: 'comunicacao',
    title: 'Como envia comunicados ou lembretes de propinas aos pais?',
    options: [
      { label: 'Apenas por reuniões ou bilhetes em papel', value: 'papel', score: 1 },
      { label: 'Grupos de WhatsApp (uma confusão de mensagens)', value: 'whatsapp', score: 2 },
      { label: 'Chamadas individuais da secretaria', value: 'chamadas', score: 3 },
      { label: 'Temos um portal, mas quase ninguém usa', value: 'portal', score: 4 },
    ],
  },
  {
    id: 'controlo',
    title: 'Se estiver fora da escola hoje, consegue saber o saldo da caixa?',
    options: [
      { label: 'Não, tenho de estar na escola para saber tudo', value: 'nao', score: 1 },
      { label: 'Peço relatórios que demoram a chegar', value: 'relatorios', score: 2 },
      { label: 'Recebo um resumo por WhatsApp ao fim do dia', value: 'resumo', score: 3 },
      { label: 'Tenho acesso básico, mas não confio 100% nos dados', value: 'basico', score: 4 },
    ],
  },
]

const STEP_TITLES = ['Contexto', 'Matrículas', 'Financeiro', 'Notas', 'Comunicação', 'Direção', 'Relatório']

const TRUST_POINTS = [
  'Leva menos de 2 minutos',
  'Feito para a realidade escolar em Angola',
  'Entrega um diagnóstico prático, não genérico',
]

const IMPACT_AREAS = [
  {
    title: 'Receita e cobranças',
    description: 'Mostra onde a escola ainda perde tempo e dinheiro para saber quem pagou e quem ficou em atraso.',
  },
  {
    title: 'Secretaria e operação',
    description: 'Revela gargalos em matrícula, notas, comunicação e atendimento ao encarregado.',
  },
  {
    title: 'Direção e controlo',
    description: 'Mede o quanto a gestão depende de papel, Excel, WhatsApp e relatórios tardios.',
  },
]

const headingStyle = { fontFamily: 'var(--font-sora), sans-serif' }

const scoreHelper = (score: number) => {
  if (score <= 2) {
    return 'Indica processo manual, retrabalho e baixa previsibilidade operacional.'
  }
  return 'Mostra maior estrutura, mas ainda com espaço claro para automação e escala.'
}

export function DiagnosisPageClient() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [leadData, setLeadData] = useState({ nome: '', escola: '', whatsapp: '', email: '' })
  const [afiliado, setAfiliado] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [phoneError, setPhoneError] = useState('')

  useEffect(() => {
    const ref = searchParams.get('ref') || searchParams.get('coupon')
    if (ref) setAfiliado(ref.toUpperCase())
  }, [searchParams])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.klasse.ao'
  const navPrimaryCta = { label: 'Começar agora', href: '/#onboarding' }
  const navLinksWithHome = navLinks.map((link) => ({ ...link, href: `/${link.href}` }))

  const validatePhone = (phone: string) => {
    const clean = phone.replace(/\D/g, '')
    if (clean.length === 9 && clean.startsWith('9')) return true
    if (clean.length === 12 && clean.startsWith('2449')) return true
    return false
  }

  const handleNext = () => setStep((current) => current + 1)
  const handleBack = () => setStep((current) => current - 1)

  const selectOption = (questionId: string, score: number) => {
    setAnswers((current) => ({ ...current, [questionId]: score }))
    handleNext()
  }

  const submitLead = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validatePhone(leadData.whatsapp)) {
      setPhoneError('Por favor, insira um número válido de Angola (ex: 923...)')
      return
    }

    setPhoneError('')
    setIsSubmitting(true)

    try {
      const totalScore = Object.values(answers).reduce((a, b) => a + b, 0)
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...leadData, score: totalScore, answers, afiliado }),
      })
      handleNext()
    } catch (err) {
      console.error(err)
      handleNext()
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalScore = Object.values(answers).reduce((a, b) => a + b, 0)
  const maxScore = QUESTIONS.length * 4
  const percentage = (totalScore / maxScore) * 100

  const getDiagnosis = () => {
    if (percentage < 40) {
      return {
        id: 'critico',
        title: 'Maturidade Crítica',
        desc: 'A sua escola ainda vive na era do papel. O risco de perda financeira, atraso operacional e erro humano é alto.',
        color: 'text-rose-600',
        bg: 'bg-rose-50',
        icon: <ShieldAlert className="h-12 w-12 text-rose-600" />,
      }
    }
    if (percentage < 75) {
      return {
        id: 'intermedia',
        title: 'Maturidade Intermédia',
        desc: 'A escola já usa alguma tecnologia, mas a informação continua espalhada e difícil de transformar em controlo real.',
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        icon: <Clock className="h-12 w-12 text-amber-600" />,
      }
    }
    return {
      id: 'avancada',
      title: 'Maturidade Avançada',
      desc: 'A escola já tem uma boa base digital, mas ainda pode ganhar velocidade, automação financeira e visão executiva mais forte.',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      icon: <Zap className="h-12 w-12 text-emerald-600" />,
    }
  }

  const diagnosis = getDiagnosis()
  const progressStep = Math.min(step, QUESTIONS.length + 2)
  const progressPercent = Math.max(8, Math.round((progressStep / (QUESTIONS.length + 2)) * 100))
  const questionProgressPercent = step >= 1 && step <= QUESTIONS.length ? Math.round((step / QUESTIONS.length) * 100) : 0

  const handleShare = () => {
    const text = `Fiz o diagnóstico de gestão escolar do KLASSE e o meu resultado foi: ${diagnosis.title} (${Math.round(percentage)}%). Faça o seu também em: https://klasse.ao/diagnostico`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const generatePDF = () => {
    const doc = new jsPDF()
    const brandGreen = [43, 96, 68]
    const brandGold = [200, 144, 42]
    const lightBg = [245, 240, 232]

    doc.setFillColor(brandGreen[0], brandGreen[1], brandGreen[2])
    doc.rect(0, 0, 210, 45, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(24)
    doc.text('KLASSE', 20, 22)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('SISTEMA DE GESTÃO ESCOLAR — ANGOLA', 20, 30)

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Relatório de Diagnóstico Digital', 110, 25, { align: 'left' })

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('INSTITUIÇÃO:', 20, 60)
    doc.setFont('helvetica', 'normal')
    doc.text(leadData.escola.toUpperCase(), 55, 60)

    doc.setFont('helvetica', 'bold')
    doc.text('RESPONSÁVEL:', 20, 67)
    doc.setFont('helvetica', 'normal')
    doc.text(leadData.nome, 55, 67)

    doc.setFont('helvetica', 'bold')
    doc.text('DATA:', 20, 74)
    doc.setFont('helvetica', 'normal')
    doc.text(new Date().toLocaleDateString('pt-AO'), 55, 74)

    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2])
    doc.roundedRect(20, 85, 170, 65, 3, 3, 'F')

    doc.setFontSize(12)
    doc.setTextColor(brandGreen[0], brandGreen[1], brandGreen[2])
    doc.setFont('helvetica', 'bold')
    doc.text('NÍVEL DE MATURIDADE APURADO:', 30, 100)

    doc.setFontSize(28)
    const scoreColor = diagnosis.id === 'critico' ? [220, 38, 38] : diagnosis.id === 'intermedia' ? brandGold : brandGreen
    doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2])
    doc.text(diagnosis.title.toUpperCase(), 30, 115)

    doc.setFillColor(220, 220, 220)
    doc.roundedRect(30, 122, 150, 4, 2, 2, 'F')
    doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2])
    doc.roundedRect(30, 122, (150 * percentage) / 100, 4, 2, 2, 'F')

    doc.setTextColor(80, 80, 80)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    const splitDesc = doc.splitTextToSize(diagnosis.desc, 150)
    doc.text(splitDesc, 30, 135)

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Análise por Área Estratégica', 20, 170)
    doc.setDrawColor(brandGreen[0], brandGreen[1], brandGreen[2])
    doc.setLineWidth(0.5)
    doc.line(20, 173, 40, 173)

    const areas = [
      { l: 'Matrículas e Admissões', s: answers.matriculas || 0 },
      { l: 'Controlo Financeiro', s: answers.financeiro || 0 },
      { l: 'Gestão Pedagógica (Notas)', s: answers.pautas || 0 },
      { l: 'Comunicação com Encarregados', s: answers.comunicacao || 0 },
      { l: 'Visibilidade da Direção', s: answers.controlo || 0 },
    ]

    let y = 185
    areas.forEach((area) => {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(area.l, 25, y)

      for (let i = 1; i <= 4; i += 1) {
        doc.setFillColor(i <= area.s ? brandGreen[0] : 230, i <= area.s ? brandGreen[1] : 230, i <= area.s ? brandGreen[2] : 230)
        doc.circle(160 + i * 6, y - 2, 2, 'F')
      }
      y += 10
    })

    doc.setFillColor(brandGreen[0], brandGreen[1], brandGreen[2])
    doc.rect(0, 260, 210, 37, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Deseja modernizar a sua escola?', 105, 275, { align: 'center' })
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Agende uma demonstração gratuita e receba um plano de implementação personalizado.', 105, 282, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(brandGold[0], brandGold[1], brandGold[2])
    doc.text('WWW.KLASSE.AO | +244 933 349 106', 105, 289, { align: 'center' })

    doc.save(`Diagnostico_KLASSE_${leadData.escola.replace(/\s+/g, '_')}.pdf`)
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8] text-[#1A1A1A]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(circle at top left, rgba(31,107,59,0.1), transparent 28%), radial-gradient(circle at 85% 15%, rgba(200,144,42,0.12), transparent 22%), linear-gradient(180deg, rgba(255,255,255,0.35), rgba(245,240,232,0))',
        }}
      />

      <Navbar
        appUrl={appUrl}
        links={navLinksWithHome}
        primaryCta={navPrimaryCta}
        onMenuToggle={() => setIsMenuOpen((prev) => !prev)}
      />
      <MobileMenu
        isOpen={isMenuOpen}
        links={navLinksWithHome}
        primaryCta={navPrimaryCta}
        loginHref={`${appUrl}/login`}
        onClose={() => setIsMenuOpen(false)}
      />

      <main className="relative z-10 px-6 pb-20 pt-28">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="overflow-hidden rounded-[28px] border border-white/70 bg-[#143222] text-white shadow-[0_30px_80px_rgba(20,50,34,0.25)]">
              <div className="border-b border-white/10 px-6 py-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#E8F5EE]">
                  <BarChart3 size={14} />
                  Diagnóstico KLASSE
                </div>
                <h2 className="mt-4 text-2xl font-extrabold leading-tight" style={headingStyle}>
                  Clareza real sobre a maturidade da sua gestão escolar.
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/72">
                  Um diagnóstico curto para identificar fragilidade financeira, caos operacional e falta de visibilidade da direção.
                </p>
              </div>

              <div className="space-y-5 px-6 py-6">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.2em] text-white/55">
                    <span>Etapa atual</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[#E0A93A] transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">{STEP_TITLES[progressStep - 1] ?? 'Resultado'}</p>
                </div>

                <div className="space-y-3 rounded-2xl bg-white/6 p-4">
                  {TRUST_POINTS.map((point) => (
                    <div key={point} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#E0A93A]/20 text-[#E0A93A]">
                        <Check size={14} />
                      </div>
                      <p className="text-sm text-white/80">{point}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  {IMPACT_AREAS.map((area) => (
                    <div key={area.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-black text-white">{area.title}</p>
                      <p className="mt-1 text-xs leading-5 text-white/64">{area.description}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-[#E0A93A]/30 bg-[#E0A93A]/10 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#F7D48C]">Para quem é</p>
                  <p className="mt-2 text-sm leading-6 text-white/82">
                    Diretores, administradores e secretarias que ainda dependem de Excel, papel ou processos manuais para operar.
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="intro"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="overflow-hidden rounded-[32px] border border-[#DDD8CF] bg-white/80 shadow-[0_30px_80px_rgba(20,34,24,0.08)] backdrop-blur-sm"
                >
                  <div className="grid gap-10 px-8 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-12 lg:py-14">
                    <div className="space-y-8">
                      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-xs font-bold uppercase tracking-widest text-emerald-800">
                        <BarChart3 size={16} />
                        Diagnóstico de Gestão
                      </div>
                      <div className="space-y-5">
                        <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 md:text-6xl" style={headingStyle}>
                          O seu colégio está a <span className="text-emerald-700">crescer no escuro</span>?
                        </h1>
                        <p className="max-w-2xl text-lg leading-8 text-slate-600">
                          Responda a 5 perguntas rápidas e descubra o nível de maturidade da sua gestão escolar, com foco em admissões, propinas, comunicação e controlo executivo.
                        </p>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <button onClick={handleNext} className="btn-p flex-1 justify-center py-5 text-lg group">
                          Iniciar diagnóstico gratuitamente
                          <ChevronRight className="transition-transform group-hover:translate-x-1" />
                        </button>
                        <a
                          href="https://wa.me/244933349106?text=Quero%20perceber%20como%20o%20diagn%C3%B3stico%20do%20KLASSE%20funciona"
                          className="btn-s flex-1 justify-center py-5 text-base"
                        >
                          Tirar dúvidas no WhatsApp
                        </a>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Tempo</p>
                          <p className="mt-2 text-lg font-black text-slate-900">2 min</p>
                          <p className="mt-1 text-sm text-slate-500">Sem reunião, sem espera.</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Entrega</p>
                          <p className="mt-2 text-lg font-black text-slate-900">Relatório</p>
                          <p className="mt-1 text-sm text-slate-500">Resultado acionável por WhatsApp e email.</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Foco</p>
                          <p className="mt-2 text-lg font-black text-slate-900">Angola</p>
                          <p className="mt-1 text-sm text-slate-500">Pensado para a realidade escolar local.</p>
                        </div>
                      </div>
                    </div>

                    <div className="relative overflow-hidden rounded-[28px] bg-[#0f271c] p-6 text-white">
                      <div
                        aria-hidden="true"
                        className="absolute inset-0"
                        style={{
                          background:
                            'radial-gradient(circle at 15% 20%, rgba(224,169,58,0.22), transparent 28%), radial-gradient(circle at 85% 80%, rgba(31,107,59,0.35), transparent 34%)',
                        }}
                      />
                      <div className="relative space-y-5">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
                          <ShieldAlert size={14} />
                          O que este diagnóstico mede
                        </div>
                        <div className="space-y-4">
                          {[
                            ['Matrículas', 'Se a captação e o atendimento ainda travam a secretaria.'],
                            ['Propinas', 'Se há atraso para entender inadimplência e confirmar pagamentos.'],
                            ['Pautas e notas', 'Se o fluxo pedagógico ainda depende de retrabalho manual.'],
                            ['Direção', 'Se a escola já opera com visibilidade ou ainda reage tarde.'],
                          ].map(([title, copy]) => (
                            <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                              <p className="text-sm font-black text-white">{title}</p>
                              <p className="mt-1 text-sm leading-6 text-white/70">{copy}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step >= 1 && step <= QUESTIONS.length && (
                <motion.div
                  key={`q-${step}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="overflow-hidden rounded-[32px] border border-[#DDD8CF] bg-white/85 shadow-[0_30px_80px_rgba(20,34,24,0.08)] backdrop-blur-sm"
                >
                  <div className="space-y-8 px-8 py-8 md:px-10 md:py-10">
                    <div className="flex flex-col gap-5 border-b border-slate-100 pb-8 md:flex-row md:items-end md:justify-between">
                      <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                          Pergunta {step} de {QUESTIONS.length}
                        </div>
                        <h2 className="max-w-3xl text-3xl font-extrabold leading-tight text-slate-950 md:text-4xl" style={headingStyle}>
                          {QUESTIONS[step - 1].title}
                        </h2>
                        <p className="max-w-2xl text-sm leading-6 text-slate-500">
                          Escolha a opção que melhor representa a realidade atual da sua escola. O objetivo é medir maturidade operacional, não “acertar”.
                        </p>
                      </div>
                      <div className="min-w-[180px] rounded-2xl bg-slate-50 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Progresso</p>
                        <p className="mt-2 text-2xl font-black text-slate-900">{questionProgressPercent}%</p>
                      </div>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <motion.div className="h-full bg-emerald-600" initial={{ width: 0 }} animate={{ width: `${questionProgressPercent}%` }} />
                    </div>

                    <div className="grid gap-4">
                      {QUESTIONS[step - 1].options.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => selectOption(QUESTIONS[step - 1].id, opt.score)}
                          className="group flex items-start justify-between gap-4 rounded-[24px] border border-slate-200 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-600 hover:bg-emerald-50/70 hover:shadow-lg hover:shadow-emerald-100/60"
                        >
                          <div className="space-y-2">
                            <p className="text-base font-bold text-slate-800 transition-colors group-hover:text-emerald-900">{opt.label}</p>
                            <p className="text-sm leading-6 text-slate-500">{scoreHelper(opt.score)}</p>
                          </div>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-slate-200 transition-colors group-hover:border-emerald-600">
                            <div className="h-3 w-3 rounded-full bg-emerald-600 opacity-0 transition-opacity group-hover:opacity-100" />
                          </div>
                        </button>
                      ))}
                    </div>

                    <button onClick={handleBack} className="flex items-center gap-2 text-sm font-bold text-slate-400 transition-colors hover:text-slate-600">
                      <ChevronLeft size={16} />
                      Voltar
                    </button>
                  </div>
                </motion.div>
              )}

              {step === QUESTIONS.length + 1 && (
                <motion.div
                  key="lead"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="overflow-hidden rounded-[32px] border border-[#DDD8CF] bg-white/85 shadow-[0_30px_80px_rgba(20,34,24,0.08)] backdrop-blur-sm"
                >
                  <div className="grid gap-8 px-8 py-8 md:px-10 md:py-10 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="space-y-6">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <Check size={40} />
                      </div>
                      <div className="space-y-3">
                        <h2 className="text-3xl font-extrabold text-slate-950" style={headingStyle}>O seu diagnóstico está pronto.</h2>
                        <p className="text-base leading-7 text-slate-600">
                          Falta apenas indicar para onde devemos enviar o relatório personalizado de maturidade escolar e os próximos passos recomendados.
                        </p>
                      </div>
                      <div className="space-y-3 rounded-[24px] bg-slate-50 p-5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Você vai receber</p>
                        <div className="space-y-3">
                          {[
                            'Classificação da maturidade operacional da escola',
                            'Leitura prática sobre matrícula, propinas e direção',
                            'Sugestão inicial de prioridades para modernização',
                          ].map((item) => (
                            <div key={item} className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                <Check size={14} />
                              </div>
                              <p className="text-sm text-slate-600">{item}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <form onSubmit={submitLead} className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/40">
                      <div className="space-y-1.5">
                        <label className="ml-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Seu Nome</label>
                        <input
                          required
                          type="text"
                          placeholder="Ex: Manuel dos Santos"
                          className="w-full rounded-xl border border-slate-200 p-4 outline-none transition-all focus:border-emerald-600"
                          value={leadData.nome}
                          onChange={(e) => setLeadData({ ...leadData, nome: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="ml-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Nome do Colégio</label>
                        <input
                          required
                          type="text"
                          placeholder="Ex: Colégio Esperança"
                          className="w-full rounded-xl border border-slate-200 p-4 outline-none transition-all focus:border-emerald-600"
                          value={leadData.escola}
                          onChange={(e) => setLeadData({ ...leadData, escola: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="ml-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">WhatsApp</label>
                          <input
                            required
                            type="tel"
                            placeholder="9XXXXXXXX"
                            className={`w-full rounded-xl border p-4 outline-none transition-all focus:border-emerald-600 ${phoneError ? 'border-rose-500 bg-rose-50' : 'border-slate-200'}`}
                            value={leadData.whatsapp}
                            onChange={(e) => setLeadData({ ...leadData, whatsapp: e.target.value })}
                          />
                          {phoneError ? <p className="ml-1 text-[10px] font-bold text-rose-500">{phoneError}</p> : null}
                        </div>
                        <div className="space-y-1.5">
                          <label className="ml-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Email Profissional</label>
                          <input
                            required
                            type="email"
                            placeholder="nome@email.com"
                            className="w-full rounded-xl border border-slate-200 p-4 outline-none transition-all focus:border-emerald-600"
                            value={leadData.email}
                            onChange={(e) => setLeadData({ ...leadData, email: e.target.value })}
                          />
                        </div>
                      </div>
                      <button disabled={isSubmitting} className="btn-p mt-6 w-full justify-center py-5 text-lg disabled:opacity-50">
                        {isSubmitting ? 'A processar...' : 'Ver meu diagnóstico agora'}
                        <ArrowRight size={20} />
                      </button>
                    </form>
                  </div>
                </motion.div>
              )}

              {step === QUESTIONS.length + 2 && (
                <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
                  <div className={`overflow-hidden rounded-[32px] border border-white/80 ${diagnosis.bg} shadow-[0_30px_80px_rgba(20,34,24,0.08)]`}>
                    <div className="grid gap-8 px-8 py-8 md:px-10 md:py-10 lg:grid-cols-[0.9fr_1.1fr]">
                      <div className="space-y-6 text-center lg:text-left">
                        <div className="flex justify-center lg:justify-start">{diagnosis.icon}</div>
                        <div className="space-y-2">
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Resultado do Diagnóstico</p>
                          <h2 className={`${diagnosis.color} text-4xl font-extrabold`} style={headingStyle}>{diagnosis.title}</h2>
                        </div>
                        <p className="font-medium leading-8 text-slate-700">{diagnosis.desc}</p>
                        <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
                          <button onClick={handleShare} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold shadow-sm transition-colors hover:bg-slate-50">
                            <Share2 size={14} className="text-emerald-600" />
                            Partilhar no WhatsApp
                          </button>
                          <button onClick={generatePDF} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold shadow-sm transition-colors hover:bg-slate-50">
                            <FileDown size={14} className="text-rose-600" />
                            Descarregar PDF
                          </button>
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-white/80 bg-white/70 p-6 shadow-lg shadow-white/30">
                        <div className="flex items-end justify-between gap-4">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Pontuação estimada</p>
                            <p className="mt-2 text-5xl font-black text-slate-900">{Math.round(percentage)}%</p>
                          </div>
                          <div className="rounded-2xl bg-slate-900 px-4 py-3 text-white">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">Nível</p>
                            <p className="mt-1 text-sm font-black">{diagnosis.title}</p>
                          </div>
                        </div>

                        <div className="relative mt-6 h-4 overflow-hidden rounded-full bg-white/70">
                          <motion.div
                            className={`h-full ${diagnosis.color.replace('text-', 'bg-')}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 1, delay: 0.5 }}
                          />
                        </div>

                        <div className="mt-6 grid gap-4">
                          {[
                            {
                              title: 'Financeiro',
                              text:
                                percentage < 40
                                  ? 'Risco alto de atraso na leitura de pagamentos e cobranças.'
                                  : percentage < 75
                                    ? 'Há alguma estrutura, mas ainda com esforço manual.'
                                    : 'Boa base para automação e reconciliação mais rápida.',
                            },
                            {
                              title: 'Operação',
                              text:
                                percentage < 40
                                  ? 'Secretaria sobrecarregada e dependente de papel e WhatsApp.'
                                  : percentage < 75
                                    ? 'Fluxos existem, mas ainda descentralizados.'
                                    : 'Operação mais estável, pronta para ganho de escala.',
                            },
                            {
                              title: 'Direção',
                              text:
                                percentage < 40
                                  ? 'Baixa previsibilidade para decidir com antecedência.'
                                  : percentage < 75
                                    ? 'A direção consegue ver parte do cenário, mas não em tempo real.'
                                    : 'Bom nível de visibilidade, com espaço para refinamento executivo.',
                            },
                          ].map((item) => (
                            <div key={item.title} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                              <p className="text-sm font-black text-slate-900">{item.title}</p>
                              <p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_20px_50px_rgba(20,34,24,0.06)]">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Próximo passo recomendado</p>
                        <h3 className="mt-2 text-2xl font-bold text-slate-950" style={headingStyle}>Como o KLASSE pode ajudar a sua escola</h3>
                      </div>
                      <p className="max-w-xl text-sm leading-6 text-slate-500">
                        A plataforma entra para reduzir atrito operacional, acelerar cobrança e dar mais visibilidade para direção e secretaria.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                          <Zap size={18} />
                        </div>
                        <p className="text-sm text-slate-600"><strong>Automatização Financeira:</strong> Acabe com a conferência manual de recibos bancários.</p>
                      </div>
                      <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                          <MessageCircle size={18} />
                        </div>
                        <p className="text-sm text-slate-600"><strong>Comunicação WhatsApp:</strong> Envie avisos de cobrança e notas automaticamente para os pais.</p>
                      </div>
                      <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                          <BarChart3 size={18} />
                        </div>
                        <p className="text-sm text-slate-600"><strong>Direção com dados:</strong> Veja inadimplência, crescimento e operação sem esperar consolidações manuais.</p>
                      </div>
                      <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                          <Clock size={18} />
                        </div>
                        <p className="text-sm text-slate-600"><strong>Secretaria mais leve:</strong> Reduza retrabalho em matrícula, emissão de documentos e fluxo académico.</p>
                      </div>
                    </div>

                    <div className="space-y-4 pt-6 text-center">
                      <p className="text-sm italic text-slate-500">Quer transformar a gestão da sua escola hoje?</p>
                      <a
                        href="https://wa.me/244933349106?text=Fiz%20o%20diagnóstico%20e%20quero%20conhecer%20o%20KLASSE"
                        className="btn-p w-full justify-center border-none bg-[#25D366] py-5 text-lg hover:bg-[#128C7E]"
                      >
                        <MessageCircle size={24} />
                        Agendar Demonstração Gratuita
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <FooterSection links={footerLinks} />
    </div>
  )
}
