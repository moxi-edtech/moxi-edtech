"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabaseClient"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"

type Secao = { id: string; nome: string; sala: string | null }
type Turma = { id: string; nome: string; secoes: Secao[] }

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
        const { data, error } = await supabase
          .from("turmas")
          .select("id, nome, secoes(id, nome, sala)")
          .eq("escola_id", escolaId)
          .order("nome", { ascending: true })
        if (error) throw error
        const rows = (data as any[]) || []
        setTurmas(
          rows.map((t) => ({
            id: t.id,
            nome: t.nome,
            secoes: (t.secoes || []).map((s: any) => ({ id: s.id, nome: s.nome, sala: s.sala ?? null })),
          }))
        )
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao carregar turmas")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [escolaId, supabase])

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

      {/* Aviso de responsabilidade */}
      <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900">
        A criação e edição de turmas é responsabilidade da Secretaria. Esta página é apenas para visualização.
      </div>

      {/* Lista (somente leitura) */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center gap-3 border-b border-gray-200 pb-4 mb-6">
          <div className="w-10 h-10 bg-[#0D9488]/10 text-[#0D9488] rounded-lg flex items-center justify-center">
            <i className="fas fa-chalkboard"></i>
          </div>
          <h2 className="text-lg font-semibold text-[#0B2C45]">Lista de Turmas</h2>
        </div>

        {loading && <div className="text-gray-500">Carregando...</div>}
        {!loading && error && <div className="text-red-600">{error}</div>}
        {!loading && !error && turmas.length === 0 && (
          <div className="text-gray-500">Nenhuma turma cadastrada.</div>
        )}

        {!loading && !error && turmas.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {turmas.map((turma) => (
              <div key={turma.id} className="bg-white border rounded-xl shadow-sm p-6 border-t-4 border-[#0D9488]">
                <div className="text-lg font-semibold text-[#0B2C45] border-b border-gray-200 pb-2 mb-4">
                  {turma.nome}
                </div>
                <ul className="space-y-3">
                  {turma.secoes.map((secao) => (
                    <li key={secao.id} className="bg-gray-100 p-3 rounded-md">
                      <div className="font-semibold text-[#0B2C45]">{secao.nome}</div>
                      <div className="text-xs text-gray-500">Sala: {secao.sala ?? "-"}</div>
                    </li>
                  ))}
                  {turma.secoes.length === 0 && (
                    <li className="text-sm text-gray-500">Sem seções cadastradas</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-gray-500 text-sm mt-12 border-t border-gray-200 pt-6">
        Moxi Nexa • Criamos sistemas que escalam • © 2025
      </div>
    </div>
  )
}

