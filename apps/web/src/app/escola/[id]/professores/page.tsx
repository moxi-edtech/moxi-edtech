"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabaseClient"
import {
  UserPlusIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline"
import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/solid"

type Professor = { user_id: string; nome: string; email: string; last_login: string | null }

export default function ProfessoresPage() {
  const router = useRouter()

  const [tab, setTab] = useState<"adicionar" | "atribuir" | "gerenciar">("adicionar")
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const p = useParams() as Record<string, string | string[] | undefined>
  const escolaId = useMemo(() => (Array.isArray(p.id) ? p.id[0] : (p.id ?? "")), [p.id])
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [professores, setProfessores] = useState<Professor[]>([])
  const [turmas, setTurmas] = useState<{ id: string; nome: string }[]>([])
  // cursos aqui representam as Disciplinas (mantendo nomenclatura da página)
  const [cursos, setCursos] = useState<{ id: string; nome: string }[]>([])
  // Estado para formulário de atribuição
  const [atribTurmaId, setAtribTurmaId] = useState<string>("")
  const [atribProfessorUserId, setAtribProfessorUserId] = useState<string>("")
  const [atribDisciplinaId, setAtribDisciplinaId] = useState<string>("")
  const [atribuindo, setAtribuindo] = useState(false)
  const [turmaAssignments, setTurmaAssignments] = useState<any[] | null>(null)

  const ativos = professores.filter((p) => !!p.last_login).length
  const pendentes = Math.max(0, professores.length - ativos)

  useEffect(() => {
    if (!escolaId) return
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const { data: links, error: linksErr } = await supabase
          .from("escola_users")
          .select("user_id, papel")
          .eq("escola_id", escolaId)
          .eq("papel", "professor")
        if (linksErr) throw linksErr
        const ids = (links || []).map((l) => l.user_id)

        let profs: Professor[] = []
        if (ids.length > 0) {
          const { data: profiles, error: profErr } = await supabase
            .from("profiles")
            .select("user_id, email, nome, last_login")
            .in("user_id", ids)
          if (profErr) throw profErr
          profs = (profiles || []).map((pp: any) => ({
            user_id: pp.user_id,
            email: pp.email || "",
            nome: pp.nome || "",
            last_login: pp.last_login ?? null,
          }))
        }

        // Turmas agora via API com service role (evita RLS vazio)
        let turmasLista: { id: string; nome: string }[] = []
        try {
          const res = await fetch(`/api/escolas/${escolaId}/turmas`, { cache: 'no-store' })
          const json = await res.json().catch(() => null)
          if (res.ok && Array.isArray(json?.data)) {
            turmasLista = json.data as any
          }
        } catch {}

        // Disciplinas (apelidadas de Cursos na UI) agora via API com service role (evita RLS vazio)
        let cursosLista: { id: string; nome: string }[] = []
        try {
          const res = await fetch(`/api/escolas/${escolaId}/cursos`, { cache: 'no-store' })
          const json = await res.json().catch(() => null)
          if (res.ok && Array.isArray(json?.data)) {
            cursosLista = (json.data as any[]).map((c: any) => ({ id: c.id, nome: c.nome }))
          }
        } catch {}

        if (!cancelled) {
          setProfessores(profs)
          setTurmas(turmasLista)
          setCursos(cursosLista)
        }
      } catch (e) {
        if (!cancelled)
          showToast(
            e instanceof Error ? e.message : "Falha ao carregar dados",
            "error"
          )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [escolaId, supabase])

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  // Carrega atribuições da turma selecionada (Professor–Turma–Disciplina)
  const loadTurmaAssignments = async (turmaId: string) => {
    if (!turmaId) { setTurmaAssignments(null); return }
    try {
      const res = await fetch(`/api/escolas/${escolaId}/turmas/${turmaId}/disciplinas`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao carregar atribuições')
      setTurmaAssignments(json.items || [])
    } catch (e) {
      setTurmaAssignments([])
    }
  }

  const handleSubmitAtribuir = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!atribTurmaId || !atribProfessorUserId || !atribDisciplinaId) {
      return showToast('Selecione professor, turma e disciplina', 'error')
    }
    setAtribuindo(true)
    try {
      const res = await fetch(`/api/escolas/${escolaId}/turmas/${atribTurmaId}/atribuir-professor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disciplina_id: atribDisciplinaId, professor_user_id: atribProfessorUserId }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao atribuir')
      showToast('Atribuição salva', 'success')
      await loadTurmaAssignments(atribTurmaId)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao atribuir', 'error')
    } finally {
      setAtribuindo(false)
    }
  }

  const handleInviteProfessor = async (form: FormData) => {
    const nome = String(form.get("nome") || "")
    const email = String(form.get("email") || "")
    if (!email) return showToast("Informe um e-mail válido", "error")
    try {
      const res = await fetch(`/api/escolas/${escolaId}/usuarios/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, nome, papel: "professor" }),
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao convidar")
      const numero = json?.numero as string | undefined
      showToast(numero ? `Convite enviado! Número de login: ${numero}` : "Convite enviado com sucesso!", "success")
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "Falha ao convidar professor",
        "error"
      )
    }
  }

  return (
    <div className="container mx-auto px-4">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4 py-6 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Voltar
          </button>
          <h1 className="text-3xl font-bold text-[#0B2C45]">
            Gerenciamento de Professores
          </h1>
        </div>
        <div className="flex text-sm text-gray-500">
          <span>Início</span>
          <span className="mx-2">/</span>
          <span className="text-[#0D9488] font-medium">Professores</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total */}
        <div className="bg-white rounded-xl shadow p-6 flex items-center">
          <div className="bg-[#0D9488]/10 text-[#0D9488] w-12 h-12 rounded-lg flex items-center justify-center mr-4">
            <UsersIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-[#0B2C45]">
              {loading ? "—" : professores.length}
            </h3>
            <p className="text-sm text-gray-500">Total de Professores</p>
          </div>
        </div>
        {/* Ativos */}
        <div className="bg-white rounded-xl shadow p-6 flex items-center">
          <div className="bg-green-100 text-green-600 w-12 h-12 rounded-lg flex items-center justify-center mr-4">
            <CheckCircleIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-[#0B2C45]">
              {loading ? "—" : ativos}
            </h3>
            <p className="text-sm text-gray-500">Professores Ativos</p>
          </div>
        </div>
        {/* Pendentes */}
        <div className="bg-white rounded-xl shadow p-6 flex items-center">
          <div className="bg-red-100 text-red-600 w-12 h-12 rounded-lg flex items-center justify-center mr-4">
            <ExclamationCircleIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-[#0B2C45]">
              {loading ? "—" : pendentes}
            </h3>
            <p className="text-sm text-gray-500">Pendentes de Ativação</p>
          </div>
        </div>
        {/* Cursos */}
        <div className="bg-white rounded-xl shadow p-6 flex items-center">
          <div className="bg-[#0D9488]/10 text-[#0D9488] w-12 h-12 rounded-lg flex items-center justify-center mr-4">
            <Cog6ToothIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-[#0B2C45]">
              {loading ? "—" : cursos.length}
            </h3>
            <p className="text-sm text-gray-500">Disciplinas (Cursos) Ativas</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-8">
        {["adicionar", "atribuir", "gerenciar"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`px-6 py-3 font-medium relative ${
              tab === t
                ? "text-[#0D9488]"
                : "text-gray-500 hover:text-[#0B2C45]"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {tab === t && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0D9488]" />
            )}
          </button>
        ))}
      </div>

      {/* Tab: Adicionar */}
      {tab === "adicionar" && (
        <div className="space-y-6">
          {/* Formulário */}
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center border-b border-gray-100 pb-4 mb-6">
              <UserPlusIcon className="w-6 h-6 text-[#0D9488] mr-2" />
              <h2 className="text-lg font-semibold text-[#0B2C45]">Novo Professor</h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget as HTMLFormElement)
                handleInviteProfessor(fd)
              }}
              className="space-y-4"
            >
              <input
                name="nome"
                type="text"
                className="w-full border border-gray-200 rounded-md p-2"
                placeholder="Nome completo"
                required
              />
              <input
                name="email"
                type="email"
                className="w-full border border-gray-200 rounded-md p-2"
                placeholder="Email institucional"
                required
              />
              <input
                name="telefone"
                type="tel"
                className="w-full border border-gray-200 rounded-md p-2"
                placeholder="Telefone"
              />
              <select
                name="curso"
                className="w-full border border-gray-200 rounded-md p-2"
              >
                <option value="">Selecione uma disciplina</option>
                {cursos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="bg-[#0D9488] text-white px-4 py-2 rounded-md hover:bg-[#0c7c71]"
              >
                Salvar Professor
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab: Atribuir */}
      {tab === "atribuir" && (
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center border-b border-gray-100 pb-4 mb-6">
            <ClipboardDocumentListIcon className="w-6 h-6 text-[#0D9488] mr-2" />
            <h2 className="text-lg font-semibold text-[#0B2C45]">Atribuir Professor</h2>
          </div>
          <form onSubmit={handleSubmitAtribuir} className="space-y-4">
            <select className="w-full border border-gray-200 rounded-md p-2" required value={atribProfessorUserId} onChange={(e)=>setAtribProfessorUserId(e.target.value)}>
              <option value="">Selecione um professor</option>
              {professores.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.nome || p.email}
                </option>
              ))}
            </select>
            <select className="w-full border border-gray-200 rounded-md p-2" required value={atribTurmaId} onChange={(e)=>{setAtribTurmaId(e.target.value); loadTurmaAssignments(e.target.value)}}>
              <option value="">Selecione uma turma</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
            <select className="w-full border border-gray-200 rounded-md p-2" required value={atribDisciplinaId} onChange={(e)=>setAtribDisciplinaId(e.target.value)}>
              <option value="">Selecione uma disciplina</option>
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <button type="submit" disabled={atribuindo} className="bg-[#0D9488] text-white px-4 py-2 rounded-md hover:bg-[#0c7c71] disabled:opacity-50">
              {atribuindo ? 'Salvando...' : 'Confirmar Atribuição'}
            </button>
          </form>

          {/* Lista de atribuições da turma selecionada */}
          {atribTurmaId && (
            <div className="mt-8">
              <h3 className="font-semibold text-[#0B2C45] mb-3">Atribuições da Turma</h3>
              {turmaAssignments === null ? (
                <div className="text-sm text-gray-500">Selecione uma turma para visualizar.</div>
              ) : turmaAssignments.length === 0 ? (
                <div className="text-sm text-gray-500">Nenhuma atribuição encontrada.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 text-left border">Disciplina</th>
                        <th className="p-2 text-left border">Professor</th>
                        <th className="p-2 text-left border">Vínculos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {turmaAssignments.map((a: any) => (
                        <tr key={a.id} className="border-t">
                          <td className="p-2 border">{a.disciplina?.nome || a.disciplina?.id}</td>
                          <td className="p-2 border">{a.professor?.nome || a.professor?.email || a.professor?.id}</td>
                          <td className="p-2 border">
                            <span className={`mr-2 inline-block px-2 py-0.5 rounded-full text-xs ${a.vinculos.horarios ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>Horários</span>
                            <span className={`mr-2 inline-block px-2 py-0.5 rounded-full text-xs ${a.vinculos.notas ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>Notas</span>
                            <span className={`mr-2 inline-block px-2 py-0.5 rounded-full text-xs ${a.vinculos.presencas ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>Presenças</span>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${a.vinculos.planejamento ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>Planejamento</span>
                            <button
                              onClick={async () => {
                                if (!confirm('Remover esta atribuição?')) return
                                try {
                                  const res = await fetch(`/api/escolas/${escolaId}/turmas/${atribTurmaId}/disciplinas/${a.disciplina?.id}`, { method: 'DELETE' })
                                  const json = await res.json().catch(() => null)
                                  if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao remover')
                                  showToast('Atribuição removida', 'success')
                                  loadTurmaAssignments(atribTurmaId)
                                } catch (e) {
                                  showToast(e instanceof Error ? e.message : 'Erro ao remover', 'error')
                                }
                              }}
                              className="ml-2 inline-flex items-center px-2 py-0.5 rounded border border-red-200 text-red-600 hover:bg-red-50"
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Gerenciar */}
      {tab === "gerenciar" && (
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center border-b border-gray-100 pb-4 mb-6">
            <Cog6ToothIcon className="w-6 h-6 text-[#0D9488] mr-2" />
            <h2 className="text-lg font-semibold text-[#0B2C45]">Gerenciar Professores</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {professores.map((p) => (
              <div
                key={p.user_id}
                className="bg-white border rounded-xl shadow-sm p-6 text-center"
              >
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                    p.nome || p.email
                  )}&background=0B2C45&color=fff`}
                  alt={p.nome || p.email}
                  className="w-20 h-20 rounded-full border-4 border-[#0D9488] mx-auto mb-3"
                />
                <h3 className="font-semibold text-[#0B2C45]">
                  {p.nome || "Sem nome"}
                </h3>
                <p className="text-sm text-gray-500">{p.email}</p>
                <span
                  className={`inline-block mt-2 px-3 py-1 text-xs rounded-full ${
                    p.last_login
                      ? "bg-green-100 text-green-600"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {p.last_login ? "Ativo" : "Pendente"}
                </span>
                <div className="flex justify-center gap-2 mt-4">
                  <button className="bg-white border px-3 py-1 rounded-md text-sm hover:bg-gray-50">
                    Editar
                  </button>
                  <button className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600">
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-gray-500 text-sm mt-12 border-t border-gray-200 pt-6">
        Moxi Nexa • Criamos sistemas que escalam • © 2025
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 bg-white rounded-lg shadow-lg border-l-4 p-4 flex items-start space-x-3 transition ${
            toast.type === "success" ? "border-green-500" : "border-red-500"
          }`}
        >
          <div>
            {toast.type === "success" ? (
              <CheckCircleIcon className="w-6 h-6 text-green-500" />
            ) : (
              <ExclamationCircleIcon className="w-6 h-6 text-red-500" />
            )}
          </div>
          <div>
            <div className="font-semibold">
              {toast.type === "success" ? "Sucesso" : "Erro"}
            </div>
            <div className="text-sm text-gray-600">{toast.message}</div>
          </div>
        </div>
      )}
    </div>
  )
}
