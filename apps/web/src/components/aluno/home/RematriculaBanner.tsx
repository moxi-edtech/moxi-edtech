'use client'

import { useState, useEffect } from 'react'
import { Sparkles, ArrowRight, Loader2, CheckCircle2, AlertCircle, Wallet } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

type RematriculaStatus = {
  ok: boolean
  eligible: boolean
  nextAno?: number
  hasDebt?: boolean
  alreadyDone?: boolean
  status?: string
  reason?: string
}

export function RematriculaBanner() {
  const router = useRouter()
  const [status, setStatus] = useState<RematriculaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/aluno/rematricula/status')
      const json = await res.json()
      setStatus(json)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handleConfirm = async () => {
    if (status?.hasDebt) {
      // Redirect to finance tab (implementation depends on how tabs are handled, 
      // but usually via search params or context)
      const url = new URL(window.location.href)
      url.searchParams.set('tab', 'financeiro')
      window.history.pushState({}, '', url.toString())
      return
    }

    if (!window.confirm(`Deseja confirmar sua rematrícula para o Ano Letivo ${status?.nextAno}?`)) return

    setBusy(true)
    try {
      const res = await fetch('/api/aluno/rematricula/confirmar', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao confirmar')
      
      alert('Pedido de rematrícula enviado com sucesso! A secretaria irá processar sua solicitação.')
      fetchStatus()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading || !status || (!status.eligible && !status.alreadyDone)) return null

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
            {status.alreadyDone 
              ? 'Tudo encaminhado para o próximo ano!' 
              : 'Sua vaga está pré-reservada!'}
          </h3>
          <p className="text-sm text-slate-600 mt-1 max-w-md">
            {status.alreadyDone 
              ? (status.status === 'aprovada' || status.status === 'matriculado' 
                  ? 'Sua rematrícula foi confirmada. Vemo-nos no próximo ano!' 
                  : 'Seu pedido está em análise pela secretaria. Aguarde o retorno.')
              : (status.hasDebt 
                  ? 'Regularize suas pendências financeiras para liberar a rematrícula online.' 
                  : `Garanta sua continuidade no Ano Letivo ${status.nextAno} agora mesmo.`)}
          </p>
        </div>

        <div>
          {status.alreadyDone ? (
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
                  Confirmar Agora
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Decorative background circle */}
      <div className="absolute -right-12 -top-12 w-40 h-40 bg-klasse-gold-100 rounded-full blur-3xl opacity-50" />
    </motion.div>
  )
}
