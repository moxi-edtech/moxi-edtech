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
    ]
  },
  {
    id: 'financeiro',
    title: 'Quanto tempo demora para saber quem não pagou a propina do mês?',
    options: [
      { label: 'Não sei exatamente até ao fim do mês', value: 'nao-sei', score: 1 },
      { label: 'Demoro dias a conferir depósitos bancários', value: 'dias', score: 2 },
      { label: 'Tenho uma lista, mas é difícil de gerir', value: 'dificil', score: 3 },
      { label: 'Sei quase na hora, mas o processo é manual', value: 'manual', score: 4 },
    ]
  },
  {
    id: 'pautas',
    title: 'Como os professores entregam as notas no fim do trimestre?',
    options: [
      { label: 'Em papel (temos de digitar tudo na secretaria)', value: 'papel', score: 1 },
      { label: 'Mandam ficheiros Excel por pendrive/email', value: 'excel', score: 2 },
      { label: 'Lançam num sistema, mas dá muitos erros', value: 'sistema-erro', score: 3 },
      { label: 'Lançam online, mas demora a processar pautas', value: 'online', score: 4 },
    ]
  },
  {
    id: 'comunicacao',
    title: 'Como envia comunicados ou lembretes de propinas aos pais?',
    options: [
      { label: 'Apenas por reuniões ou bilhetes em papel', value: 'papel', score: 1 },
      { label: 'Grupos de WhatsApp (uma confusão de mensagens)', value: 'whatsapp', score: 2 },
      { label: 'Chamadas individuais da secretaria', value: 'chamadas', score: 3 },
      { label: 'Temos um portal, mas quase ninguém usa', value: 'portal', score: 4 },
    ]
  },
  {
    id: 'controlo',
    title: 'Se estiver fora da escola hoje, consegue saber o saldo da caixa?',
    options: [
      { label: 'Não, tenho de estar na escola para saber tudo', value: 'nao', score: 1 },
      { label: 'Peço relatórios que demoram a chegar', value: 'relatorios', score: 2 },
      { label: 'Recebo um resumo por WhatsApp ao fim do dia', value: 'resumo', score: 3 },
      { label: 'Tenho acesso básico, mas não confio 100% nos dados', value: 'basico', score: 4 },
    ]
  }
]

export function DiagnosisPageClient() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState(0) // 0: Intro, 1-5: Questions, 6: Lead, 7: Result
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
  const navLinksWithHome = navLinks.map(l => ({ ...l, href: `/${l.href}` }))

  const validatePhone = (phone: string) => {
    const clean = phone.replace(/\D/g, '')
    // Angola mobile: 9 seguido de 8 digitos (9XXXXXXXX)
    if (clean.length === 9 && clean.startsWith('9')) return true
    // Com DDI: 2449XXXXXXXX
    if (clean.length === 12 && clean.startsWith('2449')) return true
    return false
  }

  const handleNext = () => setStep((s) => s + 1)
  const handleBack = () => setStep((s) => s - 1)

  const selectOption = (questionId: string, score: number) => {
    setAnswers({ ...answers, [questionId]: score })
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
    
    // Simular envio de API
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
      // Mesmo com erro, avançamos para mostrar o resultado para o user não ficar preso
      handleNext()
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalScore = Object.values(answers).reduce((a, b) => a + b, 0)
  const maxScore = QUESTIONS.length * 4
  const percentage = (totalScore / maxScore) * 100

  const getDiagnosis = () => {
    if (percentage < 40) return {
      id: 'critico',
      title: 'Maturidade Crítica',
      desc: 'A sua escola ainda vive na era do papel. O risco de perda financeira e erro humano é altíssimo. A secretaria está sobrecarregada.',
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      icon: <ShieldAlert className="w-12 h-12 text-rose-600" />
    }
    if (percentage < 75) return {
      id: 'intermedia',
      title: 'Maturidade Intermédia',
      desc: 'A sua escola já usa tecnologia, mas a informação está solta em ficheiros Excel. Falta controlo centralizado para crescer com segurança.',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      icon: <Clock className="w-12 h-12 text-amber-600" />
    }
    return {
      id: 'avancada',
      title: 'Maturidade Avançada',
      desc: 'Parabéns! A sua escola já está digitalizada. No entanto, o KLASSE pode automatizar a reconciliação bancária e a emissão de pautas MED em segundos.',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      icon: <Zap className="w-12 h-12 text-emerald-600" />
    }
  }

  const diagnosis = getDiagnosis()

  const handleShare = () => {
    const text = `Fiz o diagnóstico de gestão escolar do KLASSE e o meu resultado foi: ${diagnosis.title} (${Math.round(percentage)}%). Faça o seu também em: https://klasse.ao/diagnostico`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const generatePDF = () => {
    const doc = new jsPDF()
    const brandGreen = [43, 96, 68]
    const brandGold = [200, 144, 42]
    const lightBg = [245, 240, 232]
    
    // --- Header ---
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
    
    // --- Escola & Data ---
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

    // --- Result Section ---
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
    
    // Progress Bar in PDF
    doc.setFillColor(220, 220, 220)
    doc.roundedRect(30, 122, 150, 4, 2, 2, 'F')
    doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2])
    doc.roundedRect(30, 122, (150 * percentage) / 100, 4, 2, 2, 'F')
    
    doc.setTextColor(80, 80, 80)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    const splitDesc = doc.splitTextToSize(diagnosis.desc, 150)
    doc.text(splitDesc, 30, 135)
    
    // --- Detailed Analysis ---
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
      { l: 'Visibilidade da Direção', s: answers.controlo || 0 }
    ]

    let y = 185
    areas.forEach(area => {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(area.l, 25, y)
      
      // Mini score stars or dots
      for(let i=1; i<=4; i++) {
        doc.setFillColor(i <= area.s ? brandGreen[0] : 230, i <= area.s ? brandGreen[1] : 230, i <= area.s ? brandGreen[2] : 230)
        doc.circle(160 + (i * 6), y - 2, 2, 'F')
      }
      y += 10
    })
    
    // --- CTA Footer ---
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

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="intro"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center space-y-8"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-widest">
                  <BarChart3 size={16} />
                  Diagnóstico de Gestão
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight font-sora">
                  O seu Colégio está a <span className="text-emerald-700">perder dinheiro?</span>
                </h1>
                <p className="text-lg text-slate-600 leading-relaxed">
                  Responda a 5 perguntas rápidas e descubra o Nível de Maturidade da sua Gestão Escolar em Angola.
                </p>
                <button
                  onClick={handleNext}
                  className="btn-p w-full py-6 text-lg justify-center group"
                >
                  Iniciar Diagnóstico Gratuitamente
                  <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                </button>
                <p className="text-sm text-slate-400">Leva menos de 2 minutos.</p>
              </motion.div>
            )}

            {step >= 1 && step <= QUESTIONS.length && (
              <motion.div
                key={`q-${step}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
                    <span>Pergunta {step} de {QUESTIONS.length}</span>
                    <span>{Math.round((step / QUESTIONS.length) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-emerald-600"
                      initial={{ width: 0 }}
                      animate={{ width: `${(step / QUESTIONS.length) * 100}%` }}
                    />
                  </div>
                </div>

                <h2 className="text-2xl font-bold font-sora leading-tight">
                  {QUESTIONS[step - 1].title}
                </h2>

                <div className="grid gap-4">
                  {QUESTIONS[step - 1].options.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => selectOption(QUESTIONS[step - 1].id, opt.score)}
                      className="flex items-center justify-between p-5 rounded-2xl border-2 border-slate-200 bg-white hover:border-emerald-600 hover:bg-emerald-50 transition-all text-left group"
                    >
                      <span className="font-semibold text-slate-700 group-hover:text-emerald-900">{opt.label}</span>
                      <div className="w-6 h-6 rounded-full border-2 border-slate-200 group-hover:border-emerald-600 flex items-center justify-center transition-colors">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronLeft size={16} />
                  Voltar
                </button>
              </motion.div>
            )}

            {step === QUESTIONS.length + 1 && (
              <motion.div
                key="lead"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                    <Check size={40} />
                  </div>
                  <h2 className="text-3xl font-bold font-sora">O seu diagnóstico está pronto!</h2>
                  <p className="text-slate-600">Onde devemos enviar o seu relatório personalizado de Maturidade Escolar?</p>
                </div>

                <form onSubmit={submitLead} className="space-y-4 bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1">Seu Nome</label>
                    <input
                      required
                      type="text"
                      placeholder="Ex: Manuel dos Santos"
                      className="w-full p-4 rounded-xl border border-slate-200 focus:border-emerald-600 outline-none transition-all"
                      value={leadData.nome}
                      onChange={e => setLeadData({ ...leadData, nome: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1">Nome do Colégio</label>
                    <input
                      required
                      type="text"
                      placeholder="Ex: Colégio Esperança"
                      className="w-full p-4 rounded-xl border border-slate-200 focus:border-emerald-600 outline-none transition-all"
                      value={leadData.escola}
                      onChange={e => setLeadData({ ...leadData, escola: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1">WhatsApp</label>
                      <input
                        required
                        type="tel"
                        placeholder="9XXXXXXXX"
                        className={`w-full p-4 rounded-xl border ${phoneError ? 'border-rose-500 bg-rose-50' : 'border-slate-200'} focus:border-emerald-600 outline-none transition-all`}
                        value={leadData.whatsapp}
                        onChange={e => setLeadData({ ...leadData, whatsapp: e.target.value })}
                      />
                      {phoneError && <p className="text-[10px] text-rose-500 font-bold ml-1">{phoneError}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1">Email Profissional</label>
                      <input
                        required
                        type="email"
                        placeholder="nome@email.com"
                        className="w-full p-4 rounded-xl border border-slate-200 focus:border-emerald-600 outline-none transition-all"
                        value={leadData.email}
                        onChange={e => setLeadData({ ...leadData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <button
                    disabled={isSubmitting}
                    className="btn-p w-full py-5 text-lg justify-center mt-6 disabled:opacity-50"
                  >
                    {isSubmitting ? 'A processar...' : 'Ver Meu Diagnóstico Agora'}
                    <ArrowRight size={20} />
                  </button>
                </form>
              </motion.div>
            )}

            {step === QUESTIONS.length + 2 && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-8"
              >
                <div className={`p-8 rounded-3xl ${diagnosis.bg} border-2 border-white text-center space-y-6 shadow-2xl shadow-slate-200`}>
                  <div className="flex justify-center">{diagnosis.icon}</div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Resultado do Diagnóstico</p>
                    <h2 className={`text-4xl font-extrabold font-sora ${diagnosis.color}`}>{diagnosis.title}</h2>
                  </div>
                  
                  <div className="relative h-4 bg-white/50 rounded-full overflow-hidden">
                    <motion.div 
                      className={`h-full ${diagnosis.color.replace('text-', 'bg-')}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                    />
                  </div>

                  <p className="text-slate-700 leading-relaxed font-medium">
                    {diagnosis.desc}
                  </p>

                  <div className="flex flex-wrap gap-3 justify-center pt-2">
                    <button 
                      onClick={handleShare}
                      className="flex items-center gap-2 px-4 py-2 bg-white rounded-full text-xs font-bold border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      <Share2 size={14} className="text-emerald-600" />
                      Partilhar no WhatsApp
                    </button>
                    <button 
                      onClick={generatePDF}
                      className="flex items-center gap-2 px-4 py-2 bg-white rounded-full text-xs font-bold border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      <FileDown size={14} className="text-rose-600" />
                      Descarregar PDF
                    </button>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-slate-200 space-y-6">
                  <h3 className="text-xl font-bold font-sora">Como o KLASSE pode ajudar?</h3>
                  <div className="grid gap-4">
                    <div className="flex gap-4 items-start p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0">
                        <Zap size={18} />
                      </div>
                      <p className="text-sm text-slate-600"><strong>Automatização Financeira:</strong> Acabe com a conferência manual de recibos bancários.</p>
                    </div>
                    <div className="flex gap-4 items-start p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0">
                        <MessageCircle size={18} />
                      </div>
                      <p className="text-sm text-slate-600"><strong>Comunicação WhatsApp:</strong> Envie avisos de cobrança e notas automaticamente para os pais.</p>
                    </div>
                  </div>

                  <div className="pt-6 text-center space-y-4">
                    <p className="text-slate-500 text-sm italic">Quer transformar a gestão da sua escola hoje?</p>
                    <a 
                      href="https://wa.me/244933349106?text=Fiz%20o%20diagnóstico%20e%20quero%20conhecer%20o%20KLASSE"
                      className="btn-p w-full py-5 text-lg justify-center bg-[#25D366] hover:bg-[#128C7E] border-none"
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
      </main>

      <FooterSection links={footerLinks} />
    </div>
  )
}
