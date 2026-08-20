"use client";

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabaseClient"
import { ArrowLeft, School, CheckCircle2, AlertCircle } from "lucide-react"

// Design tokens KLASSE
const C = {
  green: "#1F6B3B",
  gold: "#E3B23C",
  rose: "#e11d48",
} as const;

// Interface Turma
interface Turma {
  id: string;
  nome: string;
  turno: string;
  sala: string | null;
  capacidade_maxima: number | null;
  ano_letivo: string | null;
  session_id?: string;
  ocupacao_atual?: number;
}

export default function TurmasPage() {
  const router = useRouter()
  const p = useParams() as Record<string, string | string[] | undefined>
  const escolaId = useMemo(() => (Array.isArray(p.id) ? p.id[0] : (p.id ?? "")), [p.id])
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!escolaId) return
      setLoading(true)
      setError(null)
      try {
        // ✅ Buscar da view com ocupação real
        const { data: viewData, error: viewError } = await supabase
          .from("vw_turmas_para_matricula")
          .select(`
            id, 
            turma_nome, 
            turno,
            sala,
            capacidade_maxima,
            ano_letivo,
            session_id,
            ocupacao_atual
          `)
          .eq("escola_id", escolaId)
          .order("turma_nome", { ascending: true })

        if (!viewError && viewData) {
          setTurmas(viewData.map((t: any) => ({
            id: t.id,
            nome: t.turma_nome || "Sem Nome",
            turno: t.turno || "sem_turno",
            sala: t.sala,
            capacidade_maxima: t.capacidade_maxima,
            ano_letivo: t.ano_letivo,
            session_id: t.session_id,
            ocupacao_atual: t.ocupacao_atual || 0
          })))
        } else {
          // Fallback caso a view falhe
          const { data, error } = await supabase
            .from("turmas")
            .select(`
              id, 
              nome, 
              turno,
              sala,
              capacidade_maxima,
              ano_letivo,
              session_id
            `)
            .eq("escola_id", escolaId)
            .order("nome", { ascending: true })

          if (error) throw error
          
          const turmasData: Turma[] = (data || []).map((t: any) => ({
            id: t.id,
            nome: t.nome,
            turno: t.turno || 'sem_turno',
            sala: t.sala,
            capacidade_maxima: t.capacidade_maxima,
            ano_letivo: t.ano_letivo,
            session_id: t.session_id,
            ocupacao_atual: 0
          }))

          setTurmas(turmasData)
        }
        
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao carregar turmas")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [escolaId, supabase])

  // ✅ Labels para turnos
  const getTurnoLabel = (turno: string) => {
    const turnos: Record<string, string> = {
      manha: "Manhã",
      tarde: "Tarde", 
      noite: "Noite",
      integral: "Integral",
      sem_turno: "Sem turno"
    }
    return turnos[turno] || turno
  }

  // Calcular ocupação percentual
  const getOcupacaoPercentual = (turma: Turma) => {
    if (!turma.capacidade_maxima || !turma.ocupacao_atual) return 0
    return Math.round((turma.ocupacao_atual / turma.capacidade_maxima) * 100)
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4 mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 bg-slate-100 border border-slate-200 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-200 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Turmas</h1>
        </div>
      </div>

      {/* Lista (somente leitura) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="text-center">
              <div className="w-8 h-8 border-3 border-slate-200 border-t-[#E3B23C] rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-sm text-slate-500">Carregando turmas...</p>
            </div>
          </div>
        )}
        
        {!loading && error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-4">
            <p className="text-rose-700 text-sm">{error}</p>
          </div>
        )}
        
        {!loading && !error && turmas.length === 0 && (
          <div className="text-center py-12">
            <School className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Nenhuma turma cadastrada</h3>
            <p className="text-xs text-slate-400">Não há turmas disponíveis para exibição.</p>
          </div>
        )}

        {!loading && !error && turmas.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {turmas.map((turma) => {
              const max = turma.capacidade_maxima || 30
              const atual = turma.ocupacao_atual || 0
              const pct = Math.min(Math.round((atual / max) * 100), 100)
              const barColor = pct >= 95 ? "bg-rose-500" : pct >= 75 ? "bg-klasse-gold-400" : "bg-[#1F6B3B]"
              const pctColor = pct >= 95 ? "text-rose-600" : pct >= 75 ? "text-klasse-gold-600" : "text-[#1F6B3B]"
              const livre = Math.max(max - atual, 0)
              
              return (
                <div key={turma.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors">
                  {/* Cabeçalho da turma */}
                  <div className="border-b border-slate-100 pb-3 mb-3">
                    <h3 className="text-base font-semibold text-slate-900 mb-0.5">
                      {turma.nome}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {turma.ano_letivo || 'Ano letivo não informado'}
                    </p>
                  </div>

                  {/* Informações */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Local / Turno:</span>
                      <div className="text-right">
                        <span className="font-medium text-slate-700 mr-2">{turma.sala || 'Sem local'}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                          {getTurnoLabel(turma.turno)}
                        </span>
                      </div>
                    </div>

                    {/* Ocupação */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">
                          {atual}<span className="text-slate-400 font-normal">/{max} alunos</span>
                        </span>
                        <span className={`text-[11px] font-bold ${pctColor}`}>
                          {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>
                          {livre > 0 ? `${livre} vaga${livre !== 1 ? "s" : ""} livre${livre !== 1 ? "s" : ""}` : "Lotada"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
