
"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabaseClient"
import {
  PlusIcon,
  PencilSquareIcon,
  XMarkIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline"

type Secao = { id: string; nome: string; sala: string | null }
type Turma = { id: string; nome: string; secoes: Secao[] }

export default function TurmasPage() {
  const router = useRouter()
  const p = useParams() as Record<string, string | string[] | undefined>
  const escolaId = useMemo(() => (Array.isArray(p.id) ? p.id[0] : (p.id ?? "")), [p.id])
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 6

  const [modal, setModal] = useState<
    | "newClass"
    | "newSection"
    | "editClass"
    | "editSection"
    | "deleteClass"
    | "deleteSection"
    | null
  >(null)
  const [selectedTurma, setSelectedTurma] = useState<string>("")
  const [selectedSecao, setSelectedSecao] = useState<Secao | null>(null)

  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  const loadData = async () => {
    if (!escolaId) return
    setLoading(true)
    try {
      const [{ count }, { data, error }] = await Promise.all([
        supabase
          .from("turmas")
          .select("id", { count: "exact", head: true })
          .eq("escola_id", escolaId),
        supabase
          .from("turmas")
          .select("id, nome, secoes(id, nome, sala)")
          .eq("escola_id", escolaId)
          .order("nome", { ascending: true })
          .range((page - 1) * pageSize, page * pageSize - 1),
      ])
      if (error) throw error
      const rows = (data as any[]) || []
      const mapped: Turma[] = rows.map((t) => ({
        id: t.id,
        nome: t.nome,
        secoes: (t.secoes || []).map((s: any) => ({ id: s.id, nome: s.nome, sala: s.sala ?? null })),
      }))
      setTurmas(mapped)
      setTotal(count || 0)
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Falha ao carregar turmas", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escolaId, page])

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
          <h1 className="text-2xl font-bold text-[#0B2C45]">Gestão de Turmas e Seções</h1>
        </div>
        <div className="text-sm text-gray-500 flex gap-2">
          <span>Início</span>
          <span>/</span>
          <span className="text-[#0D9488] font-medium">Turmas</span>
        </div>
        {/* Paginação */}
        {!loading && total > pageSize && (
          <div className="flex items-center justify-between mt-6 text-sm text-gray-600">
            <div>
              Mostrando {Math.min((page - 1) * pageSize + 1, total)}–
              {Math.min(page * pageSize, total)} de {total}
            </div>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={`px-3 py-1 rounded border ${page === 1 ? "opacity-50 cursor-not-allowed" : "bg-white hover:bg-gray-50"}`}
              >
                Anterior
              </button>
              <button
                disabled={page * pageSize >= total}
                onClick={() => setPage((p) => (p * pageSize >= total ? p : p + 1))}
                className={`px-3 py-1 rounded border ${page * pageSize >= total ? "opacity-50 cursor-not-allowed" : "bg-white hover:bg-gray-50"}`}
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Card principal */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0D9488]/10 text-[#0D9488] rounded-lg flex items-center justify-center">
              <i className="fas fa-chalkboard"></i>
            </div>
            <h2 className="text-lg font-semibold text-[#0B2C45]">Lista de Turmas</h2>
          </div>
          <button
            onClick={() => setModal("newClass")}
            className="bg-[#0D9488] text-white px-4 py-2 rounded-md hover:bg-[#0c7c71] flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" /> Nova Turma
          </button>
        </div>
        <p className="text-gray-500 mb-6">Aqui você pode visualizar, criar e editar turmas e suas respectivas seções.</p>

        {/* Grid de turmas */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {loading && (
            <div className="text-gray-500">Carregando...</div>
          )}
          {!loading && turmas.length === 0 && (
            <div className="text-gray-500">Nenhuma turma cadastrada ainda.</div>
          )}
          {!loading && turmas.map((turma) => (
            <div key={turma.id} className="bg-white border rounded-xl shadow-sm p-6 border-t-4 border-[#0D9488]">
              <div className="text-lg font-semibold text-[#0B2C45] border-b border-gray-200 pb-2 mb-4">
                {turma.nome}
              </div>
              <ul className="space-y-3 mb-4">
                {turma.secoes.map((secao) => (
                  <li key={secao.id} className="bg-gray-100 p-3 rounded-md flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-[#0B2C45]">{secao.nome}</div>
                      <div className="text-xs text-gray-500">Sala: {secao.sala ?? "-"}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedTurma(turma.id)
                          setSelectedSecao(secao)
                          setModal("editSection")
                        }}
                        className="text-sm bg-white border px-3 py-1 rounded hover:bg-gray-50 flex items-center gap-1"
                      >
                        <PencilSquareIcon className="w-4 h-4" /> Editar
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTurma(turma.id)
                          setSelectedSecao(secao)
                          setModal("deleteSection")
                        }}
                        className="text-sm bg-red-50 border border-red-200 text-red-600 px-3 py-1 rounded hover:bg-red-100"
                      >
                        Excluir
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setSelectedTurma(turma.id)
                    setModal("newSection")
                  }}
                  className="bg-[#0D9488] text-white text-sm px-3 py-2 rounded hover:bg-[#0c7c71] flex items-center gap-2"
                >
                  <PlusIcon className="w-4 h-4" /> Nova Seção
                </button>
                <button
                  onClick={() => {
                    setSelectedTurma(turma.id)
                    setModal("editClass")
                  }}
                  className="bg-white border text-sm px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-2"
                >
                  <PencilSquareIcon className="w-4 h-4" /> Editar Turma
                </button>
                <button
                  onClick={() => {
                    setSelectedTurma(turma.id)
                    setModal("deleteClass")
                  }}
                  className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded hover:bg-red-100"
                >
                  Excluir Turma
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-gray-500 text-sm mt-12 border-t border-gray-200 pt-6">
        Moxi Nexa • Criamos sistemas que escalam • © 2025
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 bg-white rounded-lg shadow-lg border-l-4 p-4 flex items-start gap-3 ${
            toast.type === "success" ? "border-green-500" : "border-red-500"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircleIcon className="w-6 h-6 text-green-500" />
          ) : (
            <ExclamationCircleIcon className="w-6 h-6 text-red-500" />
          )}
          <div>
            <div className="font-semibold">{toast.type === "success" ? "Sucesso" : "Erro"}</div>
            <div className="text-sm text-gray-600">{toast.message}</div>
          </div>
        </div>
      )}

      {/* Modal Nova Turma */}
      {modal === "newClass" && (
        <Modal title="Nova Turma" onClose={() => setModal(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const nome = (e.currentTarget as any).nome.value as string
              try {
                // validação: nome único por escola (case-insensitive)
                const { data: exists } = await supabase
                  .from("turmas")
                  .select("id")
                  .eq("escola_id", escolaId)
                  .ilike("nome", nome)
                  .limit(1)
                if ((exists || []).length > 0) throw new Error("Já existe uma turma com esse nome nesta escola.")

                const ano = new Date().getFullYear().toString()
                const { error } = await supabase
                  .from("turmas")
                  .insert({ nome, escola_id: escolaId, ano_letivo: ano } as any)
                if (error) throw error
                setModal(null)
                showToast(`Turma criada: ${nome}`)
                // recarrega para refletir ordenação e paginação
                await loadData()
              } catch (err) {
                showToast(err instanceof Error ? err.message : "Falha ao criar turma", "error")
              }
            }}
            className="space-y-4"
          >
            <input name="nome" placeholder="Ex: Turma 4" required className="w-full border p-2 rounded" />
            <button className="bg-[#0D9488] text-white px-4 py-2 rounded">Criar Turma</button>
          </form>
        </Modal>
      )}

      {/* Modal Nova Seção */}
      {modal === "newSection" && (
        <Modal title="Nova Seção" onClose={() => setModal(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const nome = (e.currentTarget as any).nome.value as string
              const sala = (e.currentTarget as any).sala.value as string
              try {
                // validação: nome único por turma (case-insensitive)
                const { data: exists } = await supabase
                  .from("secoes")
                  .select("id")
                  .eq("turma_id", selectedTurma)
                  .ilike("nome", nome)
                  .limit(1)
                if ((exists || []).length > 0) throw new Error("Já existe uma seção com esse nome nesta turma.")
                const { data, error } = await supabase
                  .from("secoes")
                  .insert({ turma_id: selectedTurma, nome, sala } as any)
                  .select("id, nome, sala")
                  .single()
                if (error) throw error
                const sec = data as any
                setTurmas((prev) => prev.map((t) => t.id === selectedTurma ? { ...t, secoes: [...t.secoes, { id: sec.id, nome: sec.nome, sala: sec.sala ?? null }] } : t))
                setModal(null)
                showToast(`Nova seção criada: ${nome}, Sala ${sala}`)
              } catch (err) {
                showToast(err instanceof Error ? err.message : "Falha ao criar seção", "error")
              }
            }}
            className="space-y-4"
          >
            <input name="nome" placeholder="Ex: Seção A" required className="w-full border p-2 rounded" />
            <input name="sala" placeholder="Ex: 404" className="w-full border p-2 rounded" />
            <button className="bg-[#0D9488] text-white px-4 py-2 rounded">Criar Seção</button>
          </form>
        </Modal>
      )}

      {/* Modal Editar Turma */}
      {modal === "editClass" && (
        <Modal title="Editar Turma" onClose={() => setModal(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const nome = (e.currentTarget as any).nome.value as string
              try {
                // validação: nome único por escola (case-insensitive)
                const { data: exists } = await supabase
                  .from("turmas")
                  .select("id")
                  .eq("escola_id", escolaId)
                  .ilike("nome", nome)
                  .neq("id", selectedTurma)
                  .limit(1)
                if ((exists || []).length > 0) throw new Error("Já existe uma turma com esse nome nesta escola.")

                const { error } = await supabase
                  .from("turmas")
                  .update({ nome } as any)
                  .eq("id", selectedTurma)
                if (error) throw error
                setTurmas((prev) => prev.map((t) => (t.id === selectedTurma ? { ...t, nome } : t)))
                setModal(null)
                showToast(`Turma atualizada para: ${nome}`)
              } catch (err) {
                showToast(err instanceof Error ? err.message : "Falha ao atualizar turma", "error")
              }
            }}
            className="space-y-4"
          >
            <input
              name="nome"
              defaultValue={turmas.find((t) => t.id === selectedTurma)?.nome}
              required
              className="w-full border p-2 rounded"
            />
            <button className="bg-[#0D9488] text-white px-4 py-2 rounded">Salvar Alterações</button>
          </form>
        </Modal>
      )}

      {/* Modal Editar Seção */}
      {modal === "editSection" && selectedSecao && (
        <Modal title="Editar Seção" onClose={() => setModal(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const nome = (e.currentTarget as any).nome.value as string
              const sala = (e.currentTarget as any).sala.value as string
              try {
                // validação: nome único por turma (case-insensitive)
                const { data: exists } = await supabase
                  .from("secoes")
                  .select("id")
                  .eq("turma_id", selectedTurma)
                  .ilike("nome", nome)
                  .neq("id", selectedSecao.id)
                  .limit(1)
                if ((exists || []).length > 0) throw new Error("Já existe uma seção com esse nome nesta turma.")

                const { error } = await supabase
                  .from("secoes")
                  .update({ nome, sala } as any)
                  .eq("id", selectedSecao.id)
                if (error) throw error
                setTurmas((prev) => prev.map((t) => t.id === selectedTurma ? { ...t, secoes: t.secoes.map((s) => s.id === selectedSecao.id ? { ...s, nome, sala } : s) } : t))
                setModal(null)
                showToast(`Seção atualizada para: ${nome}, Sala ${sala}`)
              } catch (err) {
                showToast(err instanceof Error ? err.message : "Falha ao atualizar seção", "error")
              }
            }}
            className="space-y-4"
          >
            <input name="nome" defaultValue={selectedSecao.nome} required className="w-full border p-2 rounded" />
            <input name="sala" defaultValue={selectedSecao.sala ?? ""} className="w-full border p-2 rounded" />
            <button className="bg-[#0D9488] text-white px-4 py-2 rounded">Salvar Alterações</button>
          </form>
        </Modal>
      )}
      {/* Modal Excluir Turma */}
      {modal === "deleteClass" && (
        <Modal title="Excluir Turma" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Tem certeza que deseja excluir esta turma? Esta ação pode falhar se existirem vínculos (seções, matrículas, rotinas) sem regra de cascade no banco.
            </p>
            <div className="flex gap-3 justify-end">
              <button className="px-4 py-2 border rounded" onClick={() => setModal(null)}>Cancelar</button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/escolas/${escolaId}/turmas/${selectedTurma}/delete`, { method: 'DELETE' })
                    const json = await res.json().catch(() => ({}))
                    if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao excluir turma')
                    const remaining = turmas.filter((t) => t.id !== selectedTurma)
                    const nextPage = remaining.length === 0 && page > 1 ? page - 1 : page
                    setPage(nextPage)
                    setModal(null)
                    showToast("Turma excluída com sucesso.")
                    await loadData()
                  } catch (err) {
                    showToast(err instanceof Error ? err.message : "Falha ao excluir turma", "error")
                  }
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Excluir Seção */}
      {modal === "deleteSection" && selectedSecao && (
        <Modal title="Excluir Seção" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Confirma exclusão da seção "{selectedSecao.nome}"? Pode falhar se houver dependências (ex.: rotinas, matrículas).
            </p>
            <div className="flex gap-3 justify-end">
              <button className="px-4 py-2 border rounded" onClick={() => setModal(null)}>Cancelar</button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/escolas/${escolaId}/secoes/${selectedSecao.id}/delete`, { method: 'DELETE' })
                    const json = await res.json().catch(() => ({}))
                    if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao excluir seção')
                    setTurmas((prev) => prev.map((t) => t.id === selectedTurma ? { ...t, secoes: t.secoes.filter((s) => s.id !== selectedSecao.id) } : t))
                    setModal(null)
                    showToast("Seção excluída com sucesso.")
                  } catch (err) {
                    showToast(err instanceof Error ? err.message : "Falha ao excluir seção", "error")
                  }
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h3 className="text-lg font-semibold text-[#0B2C45]">{title}</h3>
          <button onClick={onClose}>
            <XMarkIcon className="w-6 h-6 text-gray-500 hover:text-gray-700" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
