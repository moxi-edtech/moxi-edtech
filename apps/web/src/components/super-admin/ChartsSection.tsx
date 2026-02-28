// apps/web/src/components/super-admin/ChartsSection.tsx
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabaseClient"
import type { ChartsData } from "@/lib/charts"

type ChartData = { label: string; value: number }

type Props = {
  escolaId?: string
  data?: ChartsData
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pago:       { color: "#1F6B3B", label: "Pagos" },
  pendente:   { color: "#E3B23C", label: "Pendentes" },
  em_atraso:  { color: "#E11D48", label: "Em atraso" },
  cancelado:  { color: "#94A3B8", label: "Cancelados" },
}

export default function ChartsSection({ escolaId, data }: Props) {
  const [pagamentos, setPagamentos] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(!data)

  useEffect(() => {
    if (data || !escolaId) { setLoading(false); return }
  }, [escolaId, data])

  const items = data
    ? data.pagamentos.map((p) => ({ label: p.status ?? 'desconhecido', value: Number(p.total ?? 0) }))
    : pagamentos

  const total = items.reduce((a, b) => a + b.value, 0)

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <div className="lg:col-span-2 rounded-[2.5rem] bg-white border border-slate-200/60 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Fluxo de Pagamentos</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Visão geral da rede</p>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#1F6B3B]" /> Recebido
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#E3B23C]" /> Previsto
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {items.length > 0 ? items.map((p) => {
            const config = STATUS_CONFIG[p.label.toLowerCase()] || { color: "#94A3B8", label: p.label };
            const pct = total > 0 ? (p.value / total) * 100 : 0
            
            return (
              <div key={p.label}>
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {config.label}
                    </span>
                    <span className="text-2xl font-bold text-slate-900 tracking-tight">
                      {p.value.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-300">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ 
                      width: `${pct}%`, 
                      backgroundColor: config.color,
                    }}
                  />
                </div>
              </div>
            )
          }) : (
            <div className="h-48 flex flex-col items-center justify-center text-slate-200">
              <p className="text-xs font-bold uppercase tracking-widest">Sem dados no momento</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[2.5rem] bg-[#1F6B3B] p-8 text-white shadow-[0_20px_40px_rgba(31,107,59,0.15)] flex flex-col justify-between relative overflow-hidden">
        <div className="relative">
          <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-[10px] font-bold uppercase tracking-widest mb-6">Saúde Financeira</span>
          <h3 className="text-2xl font-bold tracking-tight leading-tight mb-4">Índice de<br/>Adimplência</h3>
          <p className="text-white/70 text-sm font-medium leading-relaxed">
            Esta percentagem reflete a eficiência de cobrança consolidada em todas as escolas.
          </p>
        </div>

        <div className="relative mt-10">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black tracking-tighter">
              {data?.eficiencia ?? '0'}
            </span>
            <span className="text-xl font-bold text-white/40">%</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mt-2">Performance Global</p>
        </div>
      </div>
    </section>
  )
}
