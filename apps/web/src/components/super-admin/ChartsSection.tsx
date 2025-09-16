// apps/web/src/components/super-admin/ChartsSection.tsx
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabaseClient"
import type { ChartsData } from "@/lib/charts"
import type { Database } from "@/types/supabase"

type Props = {
  escolaId?: string
  data?: ChartsData
}

type ChartData = {
  label: string
  value: number
}

export default function ChartsSection({ escolaId, data }: Props) {
  const supabase = createClient()
  const [matriculas, setMatriculas] = useState<ChartData[]>([])
  const [pagamentos, setPagamentos] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // If aggregated data already provided, skip client fetch
    if (data) {
      setLoading(false)
      return
    }

    if (!escolaId) {
      setLoading(false)
      return
    }

    let active = true

    const fetchData = async () => {
      try {
        // Matriculas: group by year (client-side)
        const { data: matriculasRows } = await supabase
          .from("matriculas")
          .select("created_at")
          .eq("escola_id", escolaId)

        const byYear: Record<string, number> = {}
        ;(matriculasRows as Array<Pick<Database["public"]["Tables"]["matriculas"]["Row"], "created_at">> | null)?.forEach(r => {
          const year = r?.created_at ? new Date(r.created_at).getFullYear().toString() : "desconhecido"
          byYear[year] = (byYear[year] ?? 0) + 1
        })

        const matriculasData: ChartData[] = Object.entries(byYear).map(([label, value]) => ({ label, value }))

        // Pagamentos: count by status
        const { data: pagamentosRows } = await supabase
          .from("pagamentos")
          .select("status")
          .eq("escola_id", escolaId)

        const byStatus: Record<string, number> = {}
        ;(pagamentosRows as Array<Pick<Database["public"]["Tables"]["pagamentos"]["Row"], "status">> | null)?.forEach(r => {
          const key = r?.status ?? "desconhecido"
          byStatus[key] = (byStatus[key] ?? 0) + 1
        })
        const pagamentosData: ChartData[] = Object.entries(byStatus).map(([label, value]) => ({ label, value }))

        if (active) {
          setMatriculas(matriculasData)
          setPagamentos(pagamentosData)
        }
      } catch (err) {
        console.error("Erro ao carregar dados de gráficos:", err)
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchData()
    return () => {
      active = false
    }
  }, [escolaId, supabase, data])

  // Renderização
  if (data) {
    // Exemplo simples com dados agregados no Super Admin
    const totalPorStatus = data.pagamentos.reduce<Record<string, number>>((acc, p) => {
      const key = (p.status ?? 'desconhecido') as string
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})

    const pagamentosList = Object.entries(totalPorStatus).map(([label, value]) => ({ label, value }))

    return (
      <section className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-6 rounded-2xl shadow border border-moxinexa-light/50">
          <h2 className="text-lg font-semibold mb-4 text-moxinexa-dark">Matrículas (total)</h2>
          <p className="text-sm text-gray-700">{data.matriculas.length} matrículas registradas</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow border border-moxinexa-light/50">
          <h2 className="text-lg font-semibold mb-4 text-moxinexa-dark">Pagamentos por status</h2>
          {pagamentosList.length ? (
            <ul className="text-sm space-y-2">
              {pagamentosList.map((p, i) => (
                <li key={i} className="flex justify-between"><span>{p.label}</span><span className="font-medium">{p.value}</span></li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Sem dados de pagamentos</p>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="grid md:grid-cols-2 gap-6 mb-6">
      {/* Matrículas */}
      <div className="bg-white p-6 rounded-2xl shadow border border-moxinexa-light/50">
        <h2 className="text-lg font-semibold mb-4 text-moxinexa-dark">Matrículas por ano</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Carregando...</p>
        ) : matriculas.length > 0 ? (
          <ul className="text-sm space-y-2">
            {matriculas.map((m, i) => (
              <li key={i} className="flex justify-between"><span>{m.label}</span><span className="font-medium">{m.value}</span></li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Sem dados de matrículas</p>
        )}
      </div>

      {/* Pagamentos */}
      <div className="bg-white p-6 rounded-2xl shadow border border-moxinexa-light/50">
        <h2 className="text-lg font-semibold mb-4 text-moxinexa-dark">Pagamentos por status</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Carregando...</p>
        ) : pagamentos.length > 0 ? (
          <ul className="text-sm space-y-2">
            {pagamentos.map((p, i) => (
              <li key={i} className="flex justify-between"><span>{p.label}</span><span className="font-medium">{p.value}</span></li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Sem dados de pagamentos</p>
        )}
      </div>
    </section>
  )
}
