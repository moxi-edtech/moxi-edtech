'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Check, ChevronRight, ChevronLeft, BarChart3, Clock, 
  ShieldAlert, Zap, ArrowRight, MessageCircle, Share2, 
  FileDown, TrendingDown, Target, Building2, Users
} from 'lucide-react'
import { jsPDF } from 'jspdf'

type Question = {
  id: string
  title: string
  subtitle: string
  options: {
    label: string
    value: string
    score: number
    risk: 'Baixo' | 'Médio' | 'Alto' | 'Crítico'
    impact: string
  }[]
}

const QUESTIONS: Question[] = [
  {
    id: 'matriculas',
    title: 'Como é feito o processo de matrículas no início do ano?',
    subtitle: 'O atendimento inicial define a percepção de valor da sua escola.',
    options: [
      { label: 'Papel e fichas físicas (muita fila)', value: 'papel', score: 1, risk: 'Crítico', impact: 'Gargalo humano e perda de documentos.' },
      { label: 'Ficheiros Excel desorganizados', value: 'excel', score: 2, risk: 'Alto', impact: 'Dificuldade de busca e duplicação de dados.' },
      { label: 'Sistema antigo que não ajuda muito', value: 'sistema-antigo', score: 3, risk: 'Médio', impact: 'Lentidão operacional e interface datada.' },
      { label: 'Processo Online Parcial', value: 'sistema-moderno', score: 4, risk: 'Baixo', impact: 'Bom caminho, mas ainda com atrito manual.' },
    ],
  },
  {
    id: 'financeiro',
    title: 'Quanto tempo demora para saber quem não pagou a propina do mês?',
    subtitle: 'Gestão de fluxo de caixa é a sobrevivência da instituição.',
    options: [
      { label: 'Não sei exatamente até ao fim do mês', value: 'nao-sei', score: 1, risk: 'Crítico', impact: 'Fuga de receita e falta de capital de giro.' },
      { label: 'Demoro dias a conferir depósitos bancários', value: 'dias', score: 2, risk: 'Alto', impact: 'Erro humano na conciliação e atraso em cobranças.' },
      { label: 'Tenho uma lista, mas é difícil de gerir', value: 'dificil', score: 3, risk: 'Médio', impact: 'Cobrança ineficiente e burocrática.' },
      { label: 'Sei quase na hora, mas o processo é manual', value: 'manual', score: 4, risk: 'Baixo', impact: 'Processo desgastante para a secretaria.' },
    ],
  },
  {
    id: 'pautas',
    title: 'Como os professores entregam as notas no fim do trimestre?',
    subtitle: 'O tempo da secretaria deve ser estratégico, não apenas digitador.',
    options: [
      { label: 'Em papel (Digitamos tudo na secretaria)', value: 'papel', score: 1, risk: 'Crítico', impact: 'Risco de erro na pauta e sobrecarga física.' },
      { label: 'Ficheiros Excel por pendrive/email', value: 'excel', score: 2, risk: 'Alto', impact: 'Versões conflitantes e vírus no sistema.' },
      { label: 'Lançam num sistema, mas dá muitos erros', value: 'sistema-erro', score: 3, risk: 'Médio', impact: 'Suporte técnico constante e stress docente.' },
      { label: 'Lançam online, mas sem pautas automáticas', value: 'online', score: 4, risk: 'Baixo', impact: 'Trabalho manual para gerar documentos finais.' },
    ],
  },
  {
    id: 'comunicacao',
    title: 'Como envia comunicados ou lembretes aos pais?',
    subtitle: 'A comunicação gera confiança e reduz a inadimplência.',
    options: [
      { label: 'Apenas por reuniões ou papel', value: 'papel', score: 1, risk: 'Crítico', impact: 'Informação não chega ao destino.' },
      { label: 'Grupos de WhatsApp desorganizados', value: 'whatsapp', score: 2, risk: 'Alto', impact: 'Exposição de dados e ruído de comunicação.' },
      { label: 'Chamadas individuais constantes', value: 'chamadas', score: 3, risk: 'Médio', impact: 'Custo telefônico alto e baixa produtividade.' },
      { label: 'Portal básico com pouco uso', value: 'portal', score: 4, risk: 'Baixo', impact: 'Falta de engajamento da comunidade escolar.' },
    ],
  },
  {
    id: 'controlo',
    title: 'Consegue saber o saldo real da escola estando fora dela?',
    subtitle: 'Visão executiva em tempo real separa amadores de profissionais.',
    options: [
      { label: 'Não, tenho de estar na escola', value: 'nao', score: 1, risk: 'Crítico', impact: 'Gestão cega e dependência total de presença.' },
      { label: 'Peço relatórios que demoram a chegar', value: 'relatorios', score: 2, risk: 'Alto', impact: 'Decisões tomadas com dados atrasados.' },
      { label: 'Recebo resumos informais no WhatsApp', value: 'resumo', score: 3, risk: 'Médio', impact: 'Dados não auditáveis e risco de manipulação.' },
      { label: 'Tenho acesso básico aos dados', value: 'basico', score: 4, risk: 'Baixo', impact: 'Visão fragmentada do negócio.' },
    ],
  },
]

const headingStyle = { fontFamily: 'var(--font-sora), sans-serif' }

export function DiagnosisPageClient() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [leadData, setLeadData] = useState({ nome: '', escola: '', whatsapp: '', email: '', qtdAlunos: '100' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleNext = () => setStep((current) => current + 1)
  const handleBack = () => setStep((current) => current - 1)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  const selectOption = (questionId: string, score: number) => {
    setAnswers((current) => ({ ...current, [questionId]: score }))
    handleNext()
  }

  const totalScore = useMemo(() => Object.values(answers).reduce((a, b) => a + b, 0), [answers])
  const maxScore = QUESTIONS.length * 4
  const percentage = (totalScore / maxScore) * 100

  const revenueLeakage = useMemo(() => {
    const alunos = parseInt(leadData.qtdAlunos) || 100
    const propinaMedia = 25000 
    const receitaMensal = alunos * propinaMedia
    const lossFactor = (100 - percentage) / 100
    const estimatedLoss = receitaMensal * 0.15 * lossFactor 
    return {
      mensal: estimatedLoss,
      anual: estimatedLoss * 10
    }
  }, [percentage, leadData.qtdAlunos])

  const submitLead = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: leadData.nome,
          escola: leadData.escola,
          whatsapp: leadData.whatsapp,
          email: leadData.email,
          score: totalScore,
          answers: answers,
          origem: 'diagnostico_gestao'
        })
      })

      if (!response.ok) throw new Error('Falha ao enviar lead')
      
      handleNext()
    } catch (error) {
      console.error('Erro ao enviar lead:', error)
      // Mesmo com erro, avançamos para não bloquear a experiência do usuário, 
      // mas o ideal seria um feedback de erro aqui.
      handleNext()
    } finally {
      setIsSubmitting(false)
    }
  }

  const getDiagnosis = () => {
    if (percentage < 40) {
      return {
        title: 'Operação Analógica (Risco Crítico)',
        desc: 'Sua escola está perdendo competitividade e dinheiro devido à dependência de processos manuais.',
        color: 'text-rose-600',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        icon: <ShieldAlert className="h-12 w-12 text-rose-600" />,
      }
    }
    if (percentage < 75) {
      return {
        title: 'Maturidade Híbrida (Eficiência Limitada)',
        desc: 'Você já deu os primeiros passos, mas a falta de integração impede o crescimento real da instituição.',
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: <Clock className="h-12 w-12 text-amber-600" />,
      }
    }
    return {
      title: 'Maturidade Digital (Alta Performance)',
      desc: 'Sua escola está acima da média, mas o KLASSE pode levar sua automação financeira a 100%.',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      icon: <Zap className="h-12 w-12 text-emerald-600" />,
    }
  }

  const diagnosis = getDiagnosis()

  return (
    <div className="diagnosis-page-shell selection:bg-klasse-gold selection:text-black">
      <div className="w-full">
        
        <AnimatePresence mode="wait">
          {/* STEP 0: INTRO */}
          {step === 0 && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="diagnosis-center-stack gap-12 md:gap-20"
            >
              <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-10 text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.3em] text-emerald-800 shadow-sm">
                  <BarChart3 size={14} /> Executive Assessment
                </div>
                <div className="flex flex-col items-center gap-6">
                  <h1 className="max-w-4xl break-words text-4xl font-black tracking-tight text-slate-950 sm:text-5xl md:text-7xl lg:text-8xl leading-[1.05]" style={headingStyle}>
                    Sua Escola está <br className="hidden md:block"/> <span className="text-emerald-700 italic">Lucrando</span> ou <br className="hidden md:block"/> Apenas Operando?
                  </h1>
                  <p className="max-w-2xl text-lg md:text-2xl leading-relaxed text-slate-600 font-medium">
                    Responda a 5 perguntas rápidas e descubra o nível de maturidade da sua gestão escolar em Angola.
                  </p>
                </div>
                <div className="flex w-full flex-col items-center gap-4">
                  <button onClick={handleNext} className="btn-p justify-center py-7 px-10 text-xl group sm:min-w-[340px] shadow-xl shadow-emerald-900/10">
                    Iniciar diagnóstico agora
                    <ChevronRight className="transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
                <div className="grid w-full gap-4 sm:grid-cols-3">
                  {[
                    { label: 'Tempo', val: '2 min' },
                    { label: 'Entrega', val: 'Relatório' },
                    { label: 'Foco', val: 'Angola' },
                  ].map(card => (
                    <div key={card.label} className="flex min-h-[112px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{card.label}</p>
                      <p className="text-2xl font-black leading-tight text-slate-900">{card.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* SEÇÃO O QUE MEDIMOS */}
              <section className="diagnosis-measure-section border-t border-slate-200 pt-12 md:pt-16">
                <div className="flex flex-col items-center gap-10 md:gap-12">
                  <div className="flex max-w-2xl flex-col items-center gap-4">
                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-800">
                      O que avaliamos
                    </div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl" style={headingStyle}>Fatores críticos de sucesso</h2>
                  </div>

                  <div className="grid w-full gap-4 md:grid-cols-2">
                    {[
                      { title: 'Matrículas', desc: 'Identificação de gargalos no atendimento e gestão de documentos físicos.', icon: Users },
                      { title: 'Propinas', desc: 'Rastreabilidade de depósitos e automação de alertas de cobrança.', icon: Building2 },
                      { title: 'Notas', desc: 'Digitalização de pautas e agilidade no conselho de notas trimestral.', icon: Target },
                      { title: 'Estratégia', desc: 'Visibilidade executiva sobre a saúde financeira e operacional da escola.', icon: TrendingDown },
                    ].map((item) => (
                      <div key={item.title} className="flex min-h-[156px] flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50">
                           <item.icon className="h-6 w-6 text-emerald-700" />
                        </div>
                        <div className="min-w-0 max-w-[280px] space-y-2">
                          <p className="text-lg font-black text-slate-950">{item.title}</p>
                          <p className="break-words text-sm font-medium leading-relaxed text-slate-600 md:text-base">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </motion.div>
          )}

          {/* QUESTIONS */}
          {step >= 1 && step <= QUESTIONS.length && (
            <motion.div
              key={`q-${step}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="diagnosis-question-shell flex flex-col gap-8"
            >
              <div className="flex flex-col items-center gap-6 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 shadow-sm">
                    Pergunta {step} de {QUESTIONS.length}
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{Math.round((step / QUESTIONS.length) * 100)}% concluído</span>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <h2 className="max-w-3xl break-words text-2xl font-black leading-tight text-slate-950 sm:text-3xl md:text-5xl" style={headingStyle}>
                    {QUESTIONS[step - 1].title}
                  </h2>
                  <p className="max-w-2xl text-base font-medium leading-relaxed text-slate-600 md:text-lg">
                    {QUESTIONS[step - 1].subtitle}
                  </p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200/50">
                  <motion.div className="h-full bg-emerald-600 shadow-[0_0_15px_rgba(5,150,105,0.3)]" initial={{ width: 0 }} animate={{ width: `${(step/QUESTIONS.length)*100}%` }} />
                </div>
              </div>

              <div className="grid gap-4">
                {QUESTIONS[step - 1].options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => selectOption(QUESTIONS[step - 1].id, opt.score)}
                    className="group flex w-full flex-col items-center gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm shadow-emerald-900/5 transition-all hover:border-emerald-600 hover:shadow-lg md:p-6"
                  >
                    <div className="min-w-0 flex w-full max-w-[560px] flex-col items-center gap-3">
                      <p className="break-words text-lg font-black leading-snug text-slate-800 transition-colors group-hover:text-emerald-950 md:text-xl">{opt.label}</p>
                      <div className="flex min-w-0 flex-col items-center gap-2">
                         <span className={`shrink-0 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                            opt.risk === 'Crítico' ? 'text-rose-600 border-rose-100 bg-rose-50' : opt.risk === 'Alto' ? 'text-orange-600 border-orange-100 bg-orange-50' : 'text-emerald-600 border-emerald-100 bg-emerald-50'
                         }`}>Risco {opt.risk}</span>
                         <p className="min-w-0 break-words text-sm font-medium leading-relaxed text-slate-500 md:text-base">{opt.impact}</p>
                      </div>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 transition-colors group-hover:border-emerald-600 group-hover:bg-emerald-50 md:h-12 md:w-12">
                      <ChevronRight size={20} className="text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-emerald-600" />
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex justify-center pt-6">
                <button onClick={handleBack} className="flex items-center gap-2 text-base font-bold text-slate-400 transition-colors hover:text-slate-600">
                  <ChevronLeft size={20} />
                  Voltar
                </button>
              </div>
            </motion.div>
          )}

          {/* LEAD FORM */}
          {step === QUESTIONS.length + 1 && (
            <motion.div
              key="lead"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="diagnosis-lead-shell"
            >
                <div className="flex w-full flex-col items-center gap-5 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700 shadow-sm">
                    <Check size={32} />
                  </div>
                  <div className="flex max-w-2xl flex-col items-center gap-3">
                    <h2 className="text-3xl font-black leading-tight text-slate-950 md:text-5xl" style={headingStyle}>Seu diagnóstico está pronto.</h2>
                    <p className="text-base font-medium leading-relaxed text-slate-600 md:text-lg">
                      Estamos processando o impacto financeiro para a sua escola. Identifique-se para visualizar o relatório completo.
                    </p>
                  </div>
                </div>

                <div className="diagnosis-lead-card rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                  <div className="mx-auto mb-8 grid w-full max-w-[620px] gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center md:grid-cols-3">
                      {[
                        'Estimativa de Perda Operacional Anual',
                        'Nível de Maturidade Digital em Angola',
                        'Plano de Implementação Sugerido',
                      ].map((item) => (
                        <div key={item} className="flex flex-col items-center gap-3">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                            <Check size={14} />
                          </div>
                          <p className="text-sm font-bold leading-snug text-slate-700">{item}</p>
                        </div>
                      ))}
                  </div>

                <form onSubmit={submitLead} className="diagnosis-lead-form">
                  <div className="space-y-2">
                    <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-slate-400">Seu Nome</label>
                    <input required type="text" placeholder="Ex: Manuel dos Santos" className="w-full rounded-xl border border-slate-200 bg-white px-5 py-4 text-base font-bold text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100" value={leadData.nome} onChange={(e) => setLeadData({ ...leadData, nome: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-slate-400">Nome do Colégio</label>
                    <input required type="text" placeholder="Ex: Colégio Esperança" className="w-full rounded-xl border border-slate-200 bg-white px-5 py-4 text-base font-bold text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100" value={leadData.escola} onChange={(e) => setLeadData({ ...leadData, escola: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                        <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-slate-400">Total de Alunos</label>
                        <select className="w-full rounded-xl border border-slate-200 bg-white px-5 py-4 text-base font-bold text-slate-900 outline-none transition-all focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100" value={leadData.qtdAlunos} onChange={(e) => setLeadData({ ...leadData, qtdAlunos: e.target.value })}>
                            <option value="100">Até 100</option>
                            <option value="300">101 a 500</option>
                            <option value="800">501 a 1000</option>
                            <option value="1500">Mais de 1000</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="ml-1 text-[11px] font-black uppercase tracking-widest text-slate-400">WhatsApp</label>
                        <input required type="tel" placeholder="9XXXXXXXX" className="w-full rounded-xl border border-slate-200 bg-white px-5 py-4 text-base font-bold text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100" value={leadData.whatsapp} onChange={(e) => setLeadData({ ...leadData, whatsapp: e.target.value })} />
                    </div>
                  </div>
                  <button disabled={isSubmitting} className="btn-p mt-3 justify-center py-5 text-lg font-black uppercase tracking-tight shadow-lg shadow-emerald-900/10 disabled:opacity-50">
                    {isSubmitting ? 'A analisar...' : 'Ver Diagnóstico Final'}
                    <ArrowRight size={24} />
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* RESULTS */}
          {step === QUESTIONS.length + 2 && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-10 max-w-5xl mx-auto w-full">
              <div className={`overflow-hidden rounded-[3rem] border ${diagnosis.border} ${diagnosis.bg} p-8 md:p-12 shadow-sm`}>
                <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
                  <div className="flex flex-col gap-8 text-center lg:text-left">
                    <div className="flex justify-center lg:justify-start">{diagnosis.icon}</div>
                    <div className="flex flex-col gap-3">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Resultado Apurado</p>
                      <h2 className={`${diagnosis.color} text-4xl font-black md:text-6xl`} style={headingStyle}>{diagnosis.title}</h2>
                    </div>
                    <p className="text-xl font-bold leading-relaxed text-slate-700">{diagnosis.desc}</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-6 rounded-[2rem] bg-white border border-slate-200 shadow-sm text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Fuga de Receita</p>
                            <p className="text-3xl font-black text-rose-600 leading-none">
                                {revenueLeakage.anual.toLocaleString('pt-AO')} Kz <span className="text-[10px] text-slate-400 block mt-1">POR ANO</span>
                            </p>
                        </div>
                        <div className="p-6 rounded-[2rem] bg-white border border-slate-200 shadow-sm text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Maturidade Digital</p>
                            <p className="text-3xl font-black text-emerald-600 leading-none">
                                {Math.round(percentage)}% <span className="text-[10px] text-slate-400 block mt-1">EFICIÊNCIA OPERACIONAL</span>
                            </p>
                        </div>
                    </div>
                  </div>

                  <div className="rounded-[2.5rem] bg-white p-8 shadow-xl shadow-slate-900/5 flex flex-col justify-center">
                    <div className="relative h-4 overflow-hidden rounded-full bg-slate-100 mb-10">
                      <motion.div className={`h-full ${diagnosis.color.replace('text-', 'bg-')}`} initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 1.5 }} />
                    </div>

                    <div className="flex flex-col gap-4">
                      {[
                        { title: 'Financeiro', text: percentage < 40 ? 'Processo manual gera fuga de receita constante.' : 'Boa base, mas exige automação para escalar.' },
                        { title: 'Operação', text: percentage < 40 ? 'Dependência de papel trava o crescimento.' : 'Organizado, mas o tempo da equipa é subutilizado.' },
                        { title: 'Visibilidade', text: percentage < 40 ? 'Gestão "cega" sobre os números reais diários.' : 'Acesso aos dados estável mas não imediato.' },
                      ].map((item) => (
                        <div key={item.title} className="rounded-2xl bg-slate-50 p-6 flex flex-col gap-1 border border-slate-100">
                          <p className="text-base font-black text-slate-900">{item.title}</p>
                          <p className="text-sm leading-relaxed text-slate-600 font-medium">{item.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[3rem] bg-slate-950 p-10 md:p-16 text-white text-center space-y-10 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,rgba(31,107,59,1),transparent)]" />
                <div className="relative max-w-2xl mx-auto space-y-6">
                    <h3 className="text-4xl font-black md:text-5xl tracking-tighter" style={headingStyle}>Pronto para modernizar?</h3>
                    <p className="text-slate-400 text-lg font-medium leading-relaxed">
                        O KLASSE ajuda a automatizar cobranças, organizar matrículas e dar visibilidade real à direção. Agende uma conversa com nossos especialistas.
                    </p>
                    <a href="https://wa.me/244933349106?text=Fiz%20o%20diagnóstico%20e%20quero%20conhecer%20o%20KLASSE" className="btn-p w-full justify-center bg-[#25D366] hover:bg-[#128C7E] py-7 text-2xl shadow-xl shadow-emerald-500/20 uppercase font-black">
                        <MessageCircle size={32} />
                        Falar no WhatsApp
                    </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
