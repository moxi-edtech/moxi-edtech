"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabaseClient"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"

// ✅ NOVA INTERFACE - Turma como container físico
interface Turma {
  id: string;
  nome: string;
  turno: string;
  sala: string | null;
  capacidade_maxima: number | null;
  ano_letivo: string | null;
  session_id?: string;
  ocupacao_atual?: number; // Alunos matriculados
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
        // ✅ NOVA CONSULTA - apenas dados físicos da turma
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
        
        // ✅ Converter dados para nova interface
        const turmasData: Turma[] = (data || []).map((t: any) => ({
          id: t.id,
          nome: t.nome,
          turno: t.turno || 'sem_turno',
          sala: t.sala,
          capacidade_maxima: t.capacidade_maxima,
          ano_letivo: t.ano_letivo,
          session_id: t.session_id
        }))

        setTurmas(turmasData)
        
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

  // ✅ Calcular ocupação percentual
  const getOcupacaoPercentual = (turma: Turma) => {
    if (!turma.capacidade_maxima || !turma.ocupacao_atual) return 0
    return Math.round((turma.ocupacao_atual / turma.capacidade_maxima) * 100)
  }

  // ✅ Cor da ocupação
  const getOcupacaoColor = (percentual: number) => {
    if (percentual >= 90) return 'bg-red-500'
    if (percentual >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4 mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 bg-gray-100 border border-gray-200 text-[#0B2C45] px-3 py-2 rounded-md hover:bg-gray-200"
          >
            <ArrowLeftIcon className="w-5 h-5" /> Voltar
          </button>
          <h1 className="text-2xl font-bold text-[#0B2C45]">Turmas</h1>
        </div>
        <div className="text-sm text-gray-500 flex gap-2">
          <span>Início</span>
          <span>/</span>
          <span className="text-[#0D9488] font-medium">Turmas</span>
        </div>
      </div>

      {/* ✅ Aviso atualizado */}
      <div className="mb-6 rounded-md border border-slate-200 bg-slate-50 p-4 text-slate-800">
        <p className="text-sm">
          <strong>Turmas = Agrupamentos Físicos/Horários</strong><br/>
          Cada turma é um container onde alunos de diferentes classes e cursos podem compartilhar o mesmo espaço/tempo.
          O contexto acadêmico (classe, curso, equipe pedagógica) é definido na matrícula.
        </p>
      </div>

      {/* Lista (somente leitura) */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center gap-3 border-b border-gray-200 pb-4 mb-6">
          <div className="w-10 h-10 bg-[#0D9488]/10 text-[#0D9488] rounded-lg flex items-center justify-center">
            <i className="fas fa-chalkboard"></i>
          </div>
          <h2 className="text-lg font-semibold text-[#0B2C45]">Containers Físicos Disponíveis</h2>
        </div>

        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-[#0D9488] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-sm text-gray-600">Carregando turmas...</p>
            </div>
          </div>
        )}
        
        {!loading && error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}
        
        {!loading && !error && turmas.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🏫</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma turma cadastrada</h3>
            <p className="text-gray-600">Não há containers físicos/horários disponíveis nesta escola.</p>
          </div>
        )}

        {!loading && !error && turmas.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {turmas.map((turma) => {
              const ocupacaoPercentual = getOcupacaoPercentual(turma)
              const ocupacaoColor = getOcupacaoColor(ocupacaoPercentual)
              
              return (
                <div key={turma.id} className="bg-white border rounded-xl shadow-sm p-6 border-t-4 border-[#0D9488] hover:shadow-md transition-shadow">
                  {/* Cabeçalho da turma */}
                  <div className="border-b border-gray-200 pb-3 mb-4">
                    <h3 className="text-lg font-semibold text-[#0B2C45] mb-1">
                      {turma.nome}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {turma.ano_letivo || 'Ano letivo não informado'}
                    </p>
                  </div>

                  {/* Informações físicas */}
                  <div className="space-y-3">
                    {/* Local e Turno */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Local/Turno:</span>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {turma.sala || 'Sem local'}
                        </p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                          {getTurnoLabel(turma.turno)}
                        </span>
                      </div>
                    </div>

                    {/* Capacidade */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Capacidade:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {turma.capacidade_maxima ? `${turma.capacidade_maxima} alunos` : 'Não definida'}
                      </span>
                    </div>

                    {/* Ocupação */}
                    {turma.capacidade_maxima && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Ocupação:</span>
                          <span className="text-sm font-medium text-gray-900">
                            {turma.ocupacao_atual || 0}/{turma.capacidade_maxima}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${ocupacaoColor} transition-all`}
                            style={{ width: `${Math.min(ocupacaoPercentual, 100)}%` }}
                          ></div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-gray-500">
                            {ocupacaoPercentual}% ocupado
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Status de disponibilidade */}
                    <div className="pt-2 border-t border-gray-100">
                      {turma.capacidade_maxima && turma.ocupacao_atual && turma.ocupacao_atual >= turma.capacidade_maxima ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          🔴 Lotada
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✅ Disponível
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 pt-6 text-center text-sm text-slate-400">
        KLASSE • Gestão escolar em escala • © 2025
      </div>
    </div>
  )
}
