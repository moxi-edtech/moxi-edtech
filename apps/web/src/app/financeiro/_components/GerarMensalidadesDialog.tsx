// apps/web/src/app/financeiro/_components/GerarMensalidadesDialog.tsx
'use client'

import { useState } from 'react'
import { CalendarDays, Wallet, Loader2, AlertCircle } from 'lucide-react'
import { useToast } from "@/components/feedback/FeedbackSystem"

export function GerarMensalidadesDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { success, error, toast: rawToast } = useToast()
  
  // Defaults para o mês seguinte
  const today = new Date()
  const [ano, setAno] = useState(today.getFullYear())
  const [mes, setMes] = useState(today.getMonth() + 1) // 1-12

  async function handleGerar() {
    setLoading(true)
    try {
      const res = await fetch('/api/financeiro/mensalidades/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ano_letivo: Number(ano),
          mes_referencia: Number(mes)
        })
      })

      const json = await res.json()
      
      if (!res.ok) throw new Error(json.error || 'Erro ao processar')

      const geradas = json.stats?.geradas || 0
      
      if (geradas > 0) {
        success(`Processo concluído! ${geradas} cobranças geradas.`)
        setOpen(false)
      } else {
        rawToast({
          variant: "info",
          title: "Processo concluído.",
          message: "Nenhuma nova cobrança foi necessária (todas já existiam ou foram barradas pelo escudo financeiro).",
        })
      }

    } catch (e: any) {
      error(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button 
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors font-medium text-sm"
      >
        <Wallet className="w-4 h-4" />
        Gerar Cobranças em Lote
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-full">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Gerar Mensalidades</h2>
            <p className="text-sm text-slate-500">Processamento em lote para toda a escola.</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div className="p-4 bg-blue-50 text-blue-800 text-sm rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>
              O sistema irá verificar todos os alunos ativos. Alunos importados com <strong>trava financeira</strong> só receberão cobrança se o mês selecionado for posterior à data de início deles.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Mês de Referência</label>
              <select 
                value={mes}
                onChange={e => setMes(Number(e.target.value))}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('pt-AO', { month: 'long' })}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Ano Letivo</label>
              <input 
                type="number"
                value={ano}
                onChange={e => setAno(Number(e.target.value))}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button 
            onClick={() => setOpen(false)}
            disabled={loading}
            className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium text-sm"
          >
            Cancelar
          </button>
          <button 
            onClick={handleGerar}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
            {loading ? 'Processando...' : 'Confirmar Geração'}
          </button>
        </div>

      </div>
    </div>
  )
}
