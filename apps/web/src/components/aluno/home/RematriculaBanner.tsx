'use client'

import { useCallback, useState, useEffect } from 'react'
import { Sparkles, ArrowRight, Loader2, CheckCircle2, Wallet, X, Upload, FileCheck2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useToast, useConfirm } from '@/components/feedback/FeedbackSystem'

type RematriculaStatus = {
  ok: boolean
  eligible: boolean
  nextAno?: number
  hasDebt?: boolean
  alreadyDone?: boolean
  status?: string
  code?: string
  reason?: string
  academic?: { decision?: string; destino?: string; disciplinaIdsPendentes?: string[] } | null
  nextWindow?: { ano: number; data_inicio?: string | null; data_fim?: string | null } | null
  rematricula?: {
    service?: { id: string; nome: string; valor: number; pricing_origin?: string; tabela_preco_id?: string | null } | null
    services?: Array<{ id: string; codigo: string; nome: string; descricao?: string | null; valor: number }>
    dadosPagamento?: { iban?: string; banco?: string; titular?: string; kwik_chave?: string }
    paymentIntent?: { id: string; status: string; amount: number; reference?: string | null; has_evidence?: boolean; submitted_at?: string | null; mensagem_aluno?: string | null; itens_pagamento?: Array<{ nome?: string; descricao?: string; valor?: number; quantidade?: number }>; rejection_reason?: string | null; receipt_pending?: boolean; receipt_url?: string | null } | null
    destination?: { curso_id: string; classe_id: string; classe_nome: string; classe_numero: number } | null
  }
}

const money = new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 })
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

function uploadWithProgress(url: string, formData: FormData, onProgress: (value: number) => void) {
  return new Promise<{ ok?: boolean; error?: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)) }
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText || '{}')
        if (xhr.status >= 200 && xhr.status < 300) resolve(json)
        else reject(new Error(json?.error || 'Falha ao enviar comprovativo'))
      } catch { reject(new Error('Resposta inválida do servidor')) }
    }
    xhr.onerror = () => reject(new Error('Falha de rede ao enviar comprovativo'))
    xhr.send(formData)
  })
}

export function RematriculaBanner() {
  const { success, error } = useToast()
  const confirm = useConfirm()
  const [status, setStatus] = useState<RematriculaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [starting, setStarting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [flowError, setFlowError] = useState<string | null>(null)
  const [evidenceMessage, setEvidenceMessage] = useState('')

  const fetchStatus = useCallback(async () => {
    setStatusError(null)
    try {
      const res = await fetch('/api/aluno/rematricula/status', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || json?.reason || 'Não foi possível verificar a rematrícula.')
      setStatus(json)
    } catch (err: unknown) {
      console.error(err)
      setStatusError(err instanceof Error ? err.message : 'Não foi possível verificar a rematrícula.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void fetchStatus()
    }
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [fetchStatus])

  useEffect(() => {
    const payment = status?.rematricula?.paymentIntent
    const shouldRefresh = Boolean(status?.hasDebt || (payment && payment.status !== 'settled'))
    if (!shouldRefresh) return
    const timer = window.setInterval(() => void fetchStatus(), 30000)
    return () => window.clearInterval(timer)
  }, [fetchStatus, status?.hasDebt, status?.rematricula?.paymentIntent])

  const handleConfirm = async () => {
    if (status?.hasDebt) {
      window.location.assign('/aluno/financeiro')
      return
    }

    setFlowError(null)
    setOpen(true)
  }

  const selectedTotal = (status?.rematricula?.service?.valor ?? 0) + (status?.rematricula?.services ?? [])
    .filter((service) => selectedServices.includes(service.id))
    .reduce((total, service) => total + service.valor, 0)

  const startPayment = async () => {
    const ok = await confirm({
      title: 'Iniciar rematrícula',
      message: `Deseja iniciar a rematrícula para ${status?.nextAno}? O total desta transação será ${money.format(selectedTotal)}.`,
      confirmLabel: 'Continuar para pagamento',
    })
    if (!ok) return
    setBusy(true)
    setStarting(true)
    try {
      const res = await fetch('/api/aluno/rematricula/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servicos_ids: selectedServices }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao iniciar rematrícula')
      setOpen(true)
      success('Rematrícula iniciada', 'Confira os dados de pagamento e envie o comprovativo desta transação.')
      void fetchStatus()
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : 'Ocorreu um problema ao processar a sua rematrícula. Por favor, tente novamente em instantes.'
      setFlowError(message)
      error(
        'Não foi possível completar o pedido',
        `${message} Se o problema persistir, contacte a secretaria.`,
      )
    } finally {
      setBusy(false)
      setStarting(false)
    }
  }

  const submitEvidence = async (file: File) => {
    setFlowError(null)
    if (!ALLOWED.includes(file.type)) return setFlowError('Tipo inválido. Envie PDF, JPG, PNG ou WEBP.')
    if (file.size > 5 * 1024 * 1024) return setFlowError('Arquivo muito grande. Limite de 5MB.')
    const intentId = status?.rematricula?.paymentIntent?.id
    if (!intentId) return setFlowError('Inicie a rematrícula antes de enviar o comprovativo.')
    const formData = new FormData()
    formData.append('intentId', intentId)
    formData.append('file', file)
    if (evidenceMessage.trim()) formData.append('mensagem', evidenceMessage.trim())
    setUploading(true)
    setUploadProgress(0)
    try {
      const json = await uploadWithProgress('/api/aluno/documentos/comprovativo', formData, setUploadProgress)
      if (!json?.ok) throw new Error(json?.error || 'Falha ao enviar comprovativo')
      success('Comprovativo enviado', 'A secretaria irá validar o pagamento e liberar o recibo financeiro.')
      await fetchStatus()
    } catch (error) {
      setFlowError(error instanceof Error ? error.message : 'Não foi possível enviar o comprovativo.')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <div className="mb-6 h-28 animate-pulse rounded-3xl border border-slate-200 bg-white" aria-label="A verificar rematrícula" />
  if (statusError && !status) return <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"><p className="font-black">Não foi possível verificar a rematrícula.</p><p className="mt-1">{statusError}</p><button type="button" onClick={() => void fetchStatus()} className="mt-3 rounded-xl bg-rose-700 px-4 py-2 text-xs font-black text-white">Tentar novamente</button></div>
  if (!status || (!status.eligible && !status.alreadyDone && !['CURRENT_ACADEMIC_YEAR_UNAVAILABLE', 'ACTIVE_ACADEMIC_YEAR_UNAVAILABLE', 'SERVICE_NOT_CONFIGURED', 'DESTINATION_CLASS_NOT_CONFIGURED', 'REMATRICULA_WINDOW_CLOSED', 'ACADEMIC_PROMOTION_PENDING'].includes(status.code || ''))) return null
  if (!status.eligible && !status.alreadyDone) {
    if (status.code === 'ACADEMIC_PROMOTION_PENDING') return <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><p className="font-black">Rematrícula ainda não disponível</p><p className="mt-1">{status.reason || 'A escola ainda está a concluir a sua situação académica. Consulte a secretaria para mais informações.'}</p>{(status.academic?.disciplinaIdsPendentes?.length ?? 0) > 0 && <p className="mt-2 text-xs font-semibold">Disciplinas pendentes: {status.academic?.disciplinaIdsPendentes?.length}</p>}<button type="button" onClick={() => void fetchStatus()} className="mt-3 rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm">Atualizar estado</button></div>
    const title = status.code === 'SERVICE_NOT_CONFIGURED'
      ? 'Taxa da classe destino ainda não configurada'
      : status.code === 'DESTINATION_CLASS_NOT_CONFIGURED'
        ? 'Classe destino ainda não configurada'
      : status.code === 'ACTIVE_ACADEMIC_YEAR_UNAVAILABLE' || status.code === 'CURRENT_ACADEMIC_YEAR_UNAVAILABLE'
        ? 'Ano letivo ainda não configurado'
        : 'Janela de rematrícula ainda não aberta'
    return <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><p className="font-black">{title}</p><p className="mt-1">{status.reason || 'A rematrícula estará disponível quando a escola concluir a configuração necessária.'}</p>{status.nextWindow?.data_inicio && <p className="mt-2 text-xs font-semibold">Próximo período previsto: {new Intl.DateTimeFormat('pt-AO', { dateStyle: 'medium' }).format(new Date(status.nextWindow.data_inicio))}</p>}<button type="button" onClick={() => void fetchStatus()} className="mt-3 rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-700 shadow-sm">Atualizar estado</button></div>
  }
  const paymentIntent = status.rematricula?.paymentIntent
  const hasPendingPayment = Boolean(paymentIntent && paymentIntent.status !== 'settled')
  const isConfirmed = Boolean(
    status.alreadyDone
      && !hasPendingPayment
      && ['aprovada', 'matriculado', 'matriculada', 'concluido', 'concluida'].includes(status.status || ''),
  )

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-klasse-gold-200 bg-gradient-to-br from-klasse-gold-50 to-white p-6 shadow-sm mb-6"
    >
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-klasse-gold-100 rounded-lg">
              <Sparkles className="h-4 w-4 text-klasse-gold-600" />
            </div>
            <span className="text-[10px] font-bold text-klasse-gold-700 uppercase tracking-widest">
              Rematrícula {status.nextAno}
            </span>
          </div>

          <h3 className="text-xl font-bold text-slate-900 leading-tight">
            {isConfirmed
              ? 'Tudo encaminhado para o próximo ano!' 
              : paymentIntent?.has_evidence
                ? 'Comprovativo recebido e em análise'
                : paymentIntent
                  ? 'Pagamento da rematrícula disponível'
              : status.alreadyDone
                ? 'Seu pedido de rematrícula já foi iniciado!'
                : status.hasDebt
                  ? 'A sua vaga está reservada; falta regularizar as mensalidades.'
                : 'Sua vaga está pré-reservada!'}
          </h3>
          <p className="text-sm text-slate-600 mt-1 max-w-md">
            {status.alreadyDone 
              ? (isConfirmed
                  ? 'Sua rematrícula foi confirmada. Vemo-nos no próximo ano!' 
                  : paymentIntent?.has_evidence
                    ? 'O comprovativo foi recebido e está em validação pela secretaria. Não é necessário pagar novamente.'
                    : paymentIntent
                      ? `A transação está disponível. Pague ${money.format(paymentIntent.amount)} e envie o comprovativo.`
                      : 'O pedido está criado. Conclua o pagamento e envie o comprovativo.')
              : (status.hasDebt 
                  ? 'Consulte o valor em dívida, envie o comprovativo e aguarde a validação. Depois poderá pagar a taxa da sua classe destino.'
                  : `Confirme a continuidade no Ano Letivo ${status.nextAno} com o valor calculado para a sua classe destino.`)}
          </p>
          {status.rematricula?.destination || status.rematricula?.service ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-700">
              {status.rematricula?.destination ? (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                  Destino: {status.rematricula.destination.classe_nome}
                </span>
              ) : null}
              {status.rematricula?.service ? (
                <span className="rounded-full border border-klasse-gold-200 bg-white px-3 py-1.5 text-klasse-gold-800">
                  Taxa: {money.format(status.rematricula.service.valor)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div>
          {isConfirmed ? (
            <div className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-slate-500 font-bold text-sm">
              <CheckCircle2 className="h-4 w-4 text-klasse-green" />
              Solicitado
            </div>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={busy}
              className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50 ${
                status.hasDebt 
                  ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50' 
                  : 'bg-klasse-gold-500 text-white hover:bg-klasse-gold-600 shadow-klasse-gold/20'
              }`}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : status.hasDebt ? (
                <>
                  <Wallet className="h-4 w-4" />
                  Regularizar Finanças
                </>
              ) : (
                <>
                  {hasPendingPayment ? 'Continuar pagamento' : 'Ver opções de rematrícula'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {statusError && <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"><span>O estado pode estar desatualizado.</span><button type="button" onClick={() => void fetchStatus()} className="font-black underline">Atualizar estado</button></div>}

      {/* Decorative background circle */}
      <div className="absolute -right-12 -top-12 w-40 h-40 bg-klasse-gold-100 rounded-full blur-3xl opacity-50" />

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-widest text-slate-400">Rematrícula {status.nextAno}</p><h4 className="mt-1 text-xl font-black text-slate-900">Confira e pague a rematrícula</h4></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-full bg-slate-100 p-2 text-slate-500"><X size={18} /></button>
            </div>

            {paymentIntent ? (
              <div className="mt-5 space-y-4">
                <div className={`rounded-2xl border p-4 ${paymentIntent.has_evidence ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}><p className={`text-xs font-black uppercase tracking-widest ${paymentIntent.has_evidence ? 'text-amber-700' : 'text-emerald-700'}`}>{paymentIntent.has_evidence ? 'Comprovativo recebido · em análise' : 'Pagamento disponível · aguarda comprovativo'}</p><p className="mt-1 text-sm text-slate-900">Referência: <strong>{paymentIntent.reference || 'Rematrícula'}</strong></p><p className="mt-1 text-2xl font-black text-slate-900">{money.format(paymentIntent.amount)}</p></div>
                {(paymentIntent.itens_pagamento?.length ?? 0) > 0 && <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm font-black text-slate-900">Detalhamento do valor</p><div className="mt-2 space-y-2">{paymentIntent.itens_pagamento?.map((item, index) => <div key={`${item.nome ?? 'item'}-${index}`} className="flex items-start justify-between gap-3 text-sm text-slate-600"><span>{item.nome || item.descricao || 'Item da rematrícula'}{item.quantidade && item.quantidade > 1 ? ` · ${item.quantidade}x` : ''}</span><strong className="text-slate-900">{money.format(Number(item.valor ?? 0) * Number(item.quantidade ?? 1))}</strong></div>)}</div><div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-sm font-black text-slate-900"><span>Total</span><span>{money.format(paymentIntent.amount)}</span></div></div>}
                {paymentIntent.status === 'settled' && paymentIntent.receipt_url ? <a href={paymentIntent.receipt_url} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-klasse-green px-4 py-3 text-sm font-black text-white"><FileCheck2 size={17} /> Abrir recibo financeiro</a> : paymentIntent.status === 'settled' && paymentIntent.receipt_pending ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="font-black">Pagamento confirmado.</p><p className="mt-1">O recibo financeiro está a ser emitido. Atualize o estado em alguns instantes.</p><button type="button" onClick={() => void fetchStatus()} className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-black text-emerald-800 shadow-sm">Atualizar estado</button></div> : paymentIntent.has_evidence && !['failed', 'rejected', 'cancelled', 'canceled'].includes(paymentIntent.status) ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-black">Comprovativo recebido · em análise pela secretaria</p><p className="mt-1">O pagamento ainda não está confirmado. A secretaria precisa validar o documento e o valor. Não envie outro comprovativo enquanto este estiver em análise.</p><button type="button" onClick={() => void fetchStatus()} className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-black text-amber-800 shadow-sm">Atualizar estado</button></div> : ['failed', 'rejected', 'cancelled', 'canceled'].includes(paymentIntent.status) ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><p className="font-black">Pagamento não confirmado</p><p className="mt-1">{paymentIntent.rejection_reason || 'A secretaria não confirmou esta transação.'} Envie um novo comprovativo ou contacte a secretaria.</p><button type="button" onClick={() => void fetchStatus()} className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-black text-rose-800 shadow-sm">Atualizar estado</button></div> : <>
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><p className="font-black text-slate-900">Como pagar</p><p className="mt-2">Banco: {status.rematricula?.dadosPagamento?.banco || 'Consulte a secretaria'}</p><p>IBAN: {status.rematricula?.dadosPagamento?.iban || 'Indisponível'}</p><p>Referência: {paymentIntent.reference || 'Rematrícula'}</p></div>
                  <textarea value={evidenceMessage} onChange={(event) => setEvidenceMessage(event.target.value)} disabled={uploading} rows={2} maxLength={500} placeholder="Mensagem para a secretaria (opcional)" className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm" />
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-klasse-green-200 bg-klasse-green-50/40 p-6 text-center"><Upload className="text-klasse-green" /><span className="text-sm font-black text-slate-900">Enviar comprovativo</span><span className="text-xs text-slate-500">PDF, JPG, PNG ou WEBP · máximo 5MB</span><input type="file" className="sr-only" accept=".pdf,image/jpeg,image/png,image/webp" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void submitEvidence(file) }} />{uploading && <span className="text-xs font-bold text-klasse-green">Enviando… {uploadProgress}%</span>}</label>
                  <p className="text-center text-xs text-slate-500">Depois do envio, a secretaria recebe o documento para validar o valor e a referência. O estado ficará “em análise” até à decisão.</p>
                </>}
                {flowError && <div className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700"><p>{flowError}</p><button type="button" onClick={() => void fetchStatus()} className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-black text-rose-800">Atualizar estado</button></div>}
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-black text-slate-900">Serviço obrigatório</p><div className="mt-2 flex items-center justify-between text-sm"><span>{status.rematricula?.service?.nome || 'Rematrícula'}</span><strong>{money.format(status.rematricula?.service?.valor || 0)}</strong></div></div>
                {(status.rematricula?.services ?? []).length > 0 && <div><p className="text-sm font-black text-slate-900">Serviços adicionais (opcionais)</p><div className="mt-2 space-y-2">{(status.rematricula?.services ?? []).map((service) => <label key={service.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 ${selectedServices.includes(service.id) ? 'border-klasse-gold bg-amber-50' : 'border-slate-200'}`}><input type="checkbox" checked={selectedServices.includes(service.id)} onChange={() => setSelectedServices((current) => current.includes(service.id) ? current.filter((id) => id !== service.id) : [...current, service.id])} className="mt-1 h-4 w-4" /><span className="flex-1 text-sm"><strong className="block text-slate-900">{service.nome}</strong><small className="block text-slate-500">{service.descricao || service.codigo}</small></span><strong className="text-sm text-klasse-green">{money.format(service.valor)}</strong></label>)}</div></div>}
                <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-base font-black"><span>Total da transação</span><span>{money.format(selectedTotal)}</span></div>
                <button type="button" onClick={() => void startPayment()} disabled={starting || !status.rematricula?.service} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-klasse-gold-500 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{starting ? <Loader2 className="animate-spin" size={17} /> : <ArrowRight size={17} />} Continuar para pagamento</button>
                {flowError && <p className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{flowError}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
