'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronRight, ChevronLeft, BarChart3, Clock, ShieldAlert, Zap, ArrowRight, MessageCircle, Share2, FileDown } from 'lucide-react'
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [phoneError, setPhoneError] = useState('')

  useEffect(() => {
    const ref = searchParams.get('ref') || searchParams.get('coupon')
    if (ref) setAfiliado(ref.toUpperCase())
  }, [searchParams])


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
    <div className="relative w-full max-w-4xl mx-auto">
      <div className="min-w-0">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col gap-12"
            >
              <div className="flex flex-col gap-8 text-center sm:text-left">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-xs font-bold uppercase tracking-widest text-emerald-800 self-center sm:self-start">
                  <BarChart3 size={16} />
                  Maturidade Digital
                </div>
                <div className="flex flex-col gap-5">
                  <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 md:text-5xl lg:text-7xl" style={headingStyle}>
                    O seu colégio está a <span className="text-emerald-700">crescer no escuro</span>?
                  </h1>
                  <p className="max-w-2xl text-xl leading-8 text-slate-600">
                    Responda a 5 perguntas rápidas e descubra o nível de maturidade da sua gestão escolar em Angola.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button onClick={handleNext} className="btn-p justify-center py-6 text-xl group sm:min-w-[320px]">
                    Iniciar diagnóstico agora
                    <ChevronRight className="transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 bg-white/50 p-6 backdrop-blur-sm shadow-sm flex flex-col gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Tempo</p>
                    <p className="text-xl font-black text-slate-900">2 min</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white/50 p-6 backdrop-blur-sm shadow-sm flex flex-col gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Entrega</p>
                    <p className="text-xl font-black text-slate-900">Relatório</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white/50 p-6 backdrop-blur-sm shadow-sm flex flex-col gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Foco</p>
                    <p className="text-xl font-black text-slate-900">Angola</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[40px] bg-[#0f271c] p-8 md:p-12 text-white shadow-2xl">
                <div className="relative flex flex-col gap-8">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70 self-start">
                    O que medimos
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    {[
                      ['Matrículas', 'Gargalos no atendimento e filas.'],
                      ['Propinas', 'Dificuldade em cobrar e conferir.'],
                      ['Notas', 'Processos manuais e pautas tardias.'],
                      ['Direção', 'Falta de dados para decidir hoje.'],
                    ].map(([title, copy]) => (
                      <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-2">
                        <p className="text-lg font-black text-white">{title}</p>
                        <p className="text-base leading-7 text-white/70">{copy}</p>
                      </div>
                    ))}
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
              className="flex flex-col gap-10"
            >
              <div className="flex flex-col gap-6 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 self-center sm:self-start">
                    Pergunta {step} de {QUESTIONS.length}
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{Math.round((step/QUESTIONS.length)*100)}% concluído</span>
                </div>
                <h2 className="text-3xl font-extrabold leading-tight text-slate-950 md:text-5xl" style={headingStyle}>
                  {QUESTIONS[step - 1].title}
                </h2>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <motion.div className="h-full bg-emerald-600" initial={{ width: 0 }} animate={{ width: `${questionProgressPercent}%` }} />
                </div>
              </div>

              <div className="grid gap-4">
                {QUESTIONS[step - 1].options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => selectOption(QUESTIONS[step - 1].id, opt.score)}
                    className="group flex items-start justify-between gap-6 rounded-[32px] border border-slate-200 bg-white p-8 text-left transition-all hover:border-emerald-600 hover:bg-emerald-50/50 hover:shadow-xl hover:shadow-emerald-900/5"
                  >
                    <div className="flex flex-col gap-2">
                      <p className="text-xl font-bold text-slate-800 transition-colors group-hover:text-emerald-900">{opt.label}</p>
                      <p className="text-sm text-slate-500 leading-relaxed">{scoreHelper(opt.score)}</p>
                    </div>
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-slate-200 transition-colors group-hover:border-emerald-600">
                      <div className="h-3 w-3 rounded-full bg-emerald-600 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-6">
                <button onClick={handleBack} className="flex items-center gap-2 text-base font-bold text-slate-400 transition-colors hover:text-slate-600">
                  <ChevronLeft size={20} />
                  Voltar à pergunta anterior
                </button>
              </div>
            </motion.div>
          )}

          {step === QUESTIONS.length + 1 && (
            <motion.div
              key="lead"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-12"
            >
              <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
                <div className="flex flex-col gap-8">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-600 shadow-lg shadow-emerald-900/10">
                    <Check size={40} />
                  </div>
                  <div className="flex flex-col gap-4">
                    <h2 className="text-4xl font-extrabold text-slate-950 md:text-5xl" style={headingStyle}>O seu diagnóstico está pronto.</h2>
                    <p className="text-lg leading-8 text-slate-600">
                      Identifique-se para gerarmos o relatório final com o nível de maturidade do seu colégio e os próximos passos sugeridos.
                    </p>
                  </div>
                  <div className="flex flex-col gap-4 rounded-[32px] border border-slate-200 bg-white/50 p-8 backdrop-blur-sm shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">O que vai receber:</p>
                    <div className="flex flex-col gap-4">
                      {[
                        'Resultado da maturidade operacional',
                        'Diagnóstico das áreas críticas',
                        'Próximos passos recomendados',
                      ].map((item) => (
                        <div key={item} className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                            <Check size={14} />
                          </div>
                          <p className="text-base font-medium text-slate-700">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <form onSubmit={submitLead} className="flex flex-col gap-6 rounded-[40px] border border-slate-200 bg-white p-8 md:p-12 shadow-2xl shadow-slate-900/5">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1">Seu Nome</label>
                    <input
                      required
                      type="text"
                      placeholder="Ex: Manuel dos Santos"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-5 outline-none transition-all focus:border-emerald-600 focus:bg-white text-lg"
                      value={leadData.nome}
                      onChange={(e) => setLeadData({ ...leadData, nome: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1">Nome do Colégio</label>
                    <input
                      required
                      type="text"
                      placeholder="Ex: Colégio Esperança"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-5 outline-none transition-all focus:border-emerald-600 focus:bg-white text-lg"
                      value={leadData.escola}
                      onChange={(e) => setLeadData({ ...leadData, escola: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1">WhatsApp (Angola)</label>
                    <input
                      required
                      type="tel"
                      placeholder="9XXXXXXXX"
                      className={`w-full rounded-2xl border bg-slate-50 p-5 outline-none transition-all focus:border-emerald-600 focus:bg-white text-lg ${phoneError ? 'border-rose-500 bg-rose-50' : 'border-slate-200'}`}
                      value={leadData.whatsapp}
                      onChange={(e) => setLeadData({ ...leadData, whatsapp: e.target.value })}
                    />
                    {phoneError && <p className="text-xs font-bold text-rose-500 ml-1">{phoneError}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1">Email Profissional</label>
                    <input
                      required
                      type="email"
                      placeholder="nome@email.com"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-5 outline-none transition-all focus:border-emerald-600 focus:bg-white text-lg"
                      value={leadData.email}
                      onChange={(e) => setLeadData({ ...leadData, email: e.target.value })}
                    />
                  </div>
                  <button disabled={isSubmitting} className="btn-p mt-4 justify-center py-6 text-xl disabled:opacity-50">
                    {isSubmitting ? 'A processar...' : 'Ver meu diagnóstico agora'}
                    <ArrowRight size={24} />
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {step === QUESTIONS.length + 2 && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-12">
              <div className={`overflow-hidden rounded-[40px] border border-white/80 ${diagnosis.bg} p-8 md:p-12 shadow-2xl shadow-slate-900/5`}>
                <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
                  <div className="flex flex-col gap-8 text-center lg:text-left">
                    <div className="flex justify-center lg:justify-start">{diagnosis.icon}</div>
                    <div className="flex flex-col gap-3">
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Resultado Apurado</p>
                      <h2 className={`${diagnosis.color} text-4xl font-extrabold md:text-6xl`} style={headingStyle}>{diagnosis.title}</h2>
                    </div>
                    <p className="text-xl font-medium leading-relaxed text-slate-700">{diagnosis.desc}</p>
                    <div className="flex flex-wrap justify-center gap-4 lg:justify-start">
                      <button onClick={handleShare} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                        <Share2 size={18} className="text-emerald-600" />
                        Partilhar WhatsApp
                      </button>
                      <button onClick={generatePDF} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                        <FileDown size={18} className="text-rose-600" />
                        Baixar Relatório PDF
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[32px] bg-white p-8 md:p-10 shadow-xl shadow-slate-900/5">
                    <div className="flex items-end justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Nível de Digitalização</p>
                        <p className="text-6xl font-black text-slate-900">{Math.round(percentage)}%</p>
                      </div>
                    </div>

                    <div className="relative mt-8 h-4 overflow-hidden rounded-full bg-slate-100">
                      <motion.div
                        className={`h-full ${diagnosis.color.replace('text-', 'bg-')}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                      />
                    </div>

                    <div className="mt-10 flex flex-col gap-4">
                      {[
                        { title: 'Financeiro', text: percentage < 40 ? 'Risco alto de inadimplência e falta de fluxo.' : percentage < 75 ? 'Esforço manual elevado para conferir.' : 'Boa base digital para automação.' },
                        { title: 'Operação', text: percentage < 40 ? 'Dependência total de papel e filas.' : percentage < 75 ? 'Fluxos descentralizados em Excel.' : 'Operação estável e organizada.' },
                        { title: 'Direção', text: percentage < 40 ? 'Visibilidade nula em tempo real.' : percentage < 75 ? 'Visão parcial dos dados diários.' : 'Excelente controlo executivo.' },
                      ].map((item) => (
                        <div key={item.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-5 flex flex-col gap-1">
                          <p className="text-base font-black text-slate-900">{item.title}</p>
                          <p className="text-sm leading-7 text-slate-600">{item.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[40px] bg-slate-950 p-10 md:p-16 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,rgba(31,107,59,1),transparent)]" />
                <div className="relative mx-auto flex max-w-3xl flex-col gap-10 text-center">
                  <div className="flex flex-col gap-4">
                    <h3 className="text-4xl font-bold tracking-tight md:text-5xl" style={headingStyle}>Pronto para modernizar a sua escola?</h3>
                    <p className="text-slate-400 text-xl leading-relaxed">
                      O KLASSE ajuda a automatizar as cobranças, organizar as matrículas e dar visibilidade real à direção.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      ['Cobrança Automática', 'Acabe com a conferência manual de depósitos.'],
                      ['Pautas Online', 'Notas lançadas no telemóvel pelo professor.'],
                      ['Comunicação WhatsApp', 'Avisos e recibos automáticos para os pais.'],
                      ['Dashboard Direção', 'Saldo de caixa e inadimplência em tempo real.'],
                    ].map(([title, desc]) => (
                      <div key={title} className="text-left p-6 rounded-3xl bg-white/5 border border-white/10 flex flex-col gap-2">
                        <p className="text-lg font-bold text-emerald-400">{title}</p>
                        <p className="text-sm text-slate-500">{desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-6 pt-6 items-center">
                    <a
                      href="https://wa.me/244933349106?text=Fiz%20o%20diagnóstico%20e%20quero%20conhecer%20o%20KLASSE"
                      className="btn-p w-full justify-center bg-[#25D366] hover:bg-[#128C7E] py-7 text-2xl shadow-xl shadow-emerald-500/20"
                    >
                      <MessageCircle size={32} />
                      Agendar Demonstração Gratuita
                    </a>
                    <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Moxi Soluções — Transformando a Educação em Angola</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
