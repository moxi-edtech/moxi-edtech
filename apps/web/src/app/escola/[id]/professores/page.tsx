"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  UserPlusIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline"
import { CheckCircleIcon, ExclamationCircleIcon } from "@heroicons/react/24/solid"

type Professor = {
  user_id: string
  nome: string
  email: string
  last_login: string | null
  disciplinas?: string[]
  disciplinas_ids?: string[]
  teacher_id?: string | null
  carga_horaria_maxima?: number | null
  turnos_disponiveis?: Array<"Manhã" | "Tarde" | "Noite">
  telefone_principal?: string | null
  habilitacoes?: string | null
  area_formacao?: string | null
  vinculo_contratual?: string | null
  is_diretor_turma?: boolean | null
  genero?: string | null
  data_nascimento?: string | null
  numero_bi?: string | null
}

export default function ProfessoresPage() {
  const router = useRouter()

  const [tab, setTab] = useState<"adicionar" | "atribuir" | "gerenciar">("adicionar")
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const p = useParams() as Record<string, string | string[] | undefined>
  const escolaId = useMemo(() => (Array.isArray(p.id) ? p.id[0] : (p.id ?? "")), [p.id])

  const [loading, setLoading] = useState(true)
  const [professores, setProfessores] = useState<Professor[]>([])
  const [turmas, setTurmas] = useState<{ id: string; nome: string }[]>([])
  const [todasTurmas, setTodasTurmas] = useState<{ id: string; nome: string }[]>([])
  // cursos aqui representam as Disciplinas (mantendo nomenclatura da página)
  const [cursos, setCursos] = useState<{ id: string; nome: string }[]>([])
  const [disciplinas, setDisciplinas] = useState<{ id: string; nome: string; catalogoId?: string | null }[]>([])
  const [disciplinasCatalogo, setDisciplinasCatalogo] = useState<{ id: string; nome: string }[]>([])
  // Estado para formulário de atribuição
  const [atribTurmaId, setAtribTurmaId] = useState<string>("")
  const [atribProfessorUserId, setAtribProfessorUserId] = useState<string>("")
  const [atribCursoId, setAtribCursoId] = useState<string>("")
  const [atribDisciplinaId, setAtribDisciplinaId] = useState<string>("")
  const [atribuindo, setAtribuindo] = useState(false)
  const [turmaAssignments, setTurmaAssignments] = useState<any[] | null>(null)

  const [teacherStep, setTeacherStep] = useState(0)
  const [teacherSubmitting, setTeacherSubmitting] = useState(false)
  const [lastCredentials, setLastCredentials] = useState<{ email: string; senha: string } | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Professor | null>(null)
  const [editForm, setEditForm] = useState({
    genero: "M" as "M" | "F",
    data_nascimento: "",
    numero_bi: "",
    telefone_principal: "",
    habilitacoes: "Licenciatura" as "Ensino Médio" | "Bacharelato" | "Licenciatura" | "Mestrado" | "Doutoramento",
    area_formacao: "",
    vinculo_contratual: "Efetivo" as "Efetivo" | "Colaborador" | "Eventual",
    carga_horaria_maxima: 20,
    turnos_disponiveis: [] as Array<"Manhã" | "Tarde" | "Noite">,
    disciplinas_habilitadas: [] as string[],
    is_diretor_turma: false,
  })
  const [teacherForm, setTeacherForm] = useState({
    nome_completo: "",
    genero: "M" as "M" | "F",
    data_nascimento: "",
    numero_bi: "",
    email: "",
    telefone_principal: "",
    habilitacoes: "Licenciatura" as "Ensino Médio" | "Bacharelato" | "Licenciatura" | "Mestrado" | "Doutoramento",
    area_formacao: "",
    vinculo_contratual: "Efetivo" as "Efetivo" | "Colaborador" | "Eventual",
    carga_horaria_maxima: 20,
    turnos_disponiveis: [] as Array<"Manhã" | "Tarde" | "Noite">,
    disciplinas_habilitadas: [] as string[],
    is_diretor_turma: false,
  })

  const ativos = professores.filter((p) => !!p.last_login).length
  const pendentes = Math.max(0, professores.length - ativos)

  useEffect(() => {
    if (!escolaId) return
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const profRes = await fetch(
          `/api/secretaria/professores?cargo=professor&days=36500&pageSize=200`,
          { cache: "no-store" }
        )
        const profJson = await profRes.json().catch(() => null)
        if (!profRes.ok || !profJson?.ok) throw new Error(profJson?.error || "Falha ao carregar professores")
        const profs = (profJson?.items || []).map((pp: any) => ({
          user_id: pp.user_id,
          email: pp.email || "",
          nome: pp.nome || "",
          last_login: pp.last_login ?? null,
          disciplinas: Array.isArray(pp.disciplinas) ? pp.disciplinas : [],
          disciplinas_ids: Array.isArray(pp.disciplinas_ids) ? pp.disciplinas_ids : [],
          teacher_id: pp.teacher_id ?? null,
          carga_horaria_maxima: pp.carga_horaria_maxima ?? null,
          turnos_disponiveis: Array.isArray(pp.turnos_disponiveis) ? pp.turnos_disponiveis : [],
          telefone_principal: pp.telefone_principal ?? null,
          habilitacoes: pp.habilitacoes ?? null,
          area_formacao: pp.area_formacao ?? null,
          vinculo_contratual: pp.vinculo_contratual ?? null,
          is_diretor_turma: pp.is_diretor_turma ?? false,
        }))

        // Turmas agora via API com service role (evita RLS vazio)
        let turmasLista: { id: string; nome: string }[] = []
        try {
          const res = await fetch(`/api/escolas/${escolaId}/turmas`, { cache: 'no-store' })
          const json = await res.json().catch(() => null)
          const payload = json?.items ?? json?.data
          if (res.ok && Array.isArray(payload)) {
            turmasLista = (payload as any[]).map((t: any) => ({
              id: t.id,
              nome: t.nome ?? t.turma_nome ?? t.turma_codigo ?? 'Sem Nome',
            }))
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
          setTodasTurmas(turmasLista)
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
  }, [escolaId])

  useEffect(() => {
    if (!escolaId) return
    if (!atribCursoId) {
      setTurmas(todasTurmas)
      setAtribTurmaId("")
      setDisciplinas([])
      setAtribDisciplinaId("")
      return
    }
    let cancelled = false
    const loadTurmas = async () => {
      try {
        const params = new URLSearchParams({ curso_id: atribCursoId })
        const res = await fetch(`/api/escolas/${escolaId}/turmas?${params.toString()}`, { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        const payload = json?.items ?? json?.data
        if (!res.ok || !Array.isArray(payload)) throw new Error(json?.error || 'Falha ao carregar turmas')
        if (!cancelled) {
          const list = (payload as any[]).map((t: any) => ({
            id: t.id,
            nome: t.nome ?? t.turma_nome ?? t.turma_codigo ?? 'Sem Nome',
          }))
          setTurmas(list)
          setAtribTurmaId("")
          setDisciplinas([])
          setAtribDisciplinaId("")
        }
      } catch {
        if (!cancelled) {
          setTurmas([])
          setAtribTurmaId("")
          setDisciplinas([])
          setAtribDisciplinaId("")
        }
      }
    }
    loadTurmas()
    return () => {
      cancelled = true
    }
  }, [atribCursoId, escolaId, todasTurmas])

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  const updateTeacherForm = (key: keyof typeof teacherForm, value: any) => {
    setTeacherForm((prev) => ({ ...prev, [key]: value }))
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
    if (!atribTurmaId || !atribProfessorUserId || !atribCursoId || !atribDisciplinaId) {
      return showToast('Selecione professor, curso, turma e disciplina', 'error')
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

  const handleCreateProfessor = async () => {
    setTeacherSubmitting(true)
    try {
      const res = await fetch(`/api/escolas/${escolaId}/professores/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...teacherForm,
          carga_horaria_maxima: Number(teacherForm.carga_horaria_maxima),
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao criar professor")
      const senhaTemp = json?.senha_temp as string | null
      if (senhaTemp) {
        const creds = { email: teacherForm.email.trim(), senha: senhaTemp }
        setLastCredentials(creds)
        localStorage.setItem("lastTeacherCredentials", JSON.stringify(creds))
      } else {
        setLastCredentials(null)
        localStorage.removeItem("lastTeacherCredentials")
      }
      showToast(
        senhaTemp
          ? `Professor criado! Senha temporária: ${senhaTemp}`
          : "Professor criado com sucesso!",
        "success"
      )
      setTeacherForm((prev) => ({
        ...prev,
        nome_completo: "",
        numero_bi: "",
        email: "",
        telefone_principal: "",
        area_formacao: "",
        turnos_disponiveis: [],
        disciplinas_habilitadas: [],
        is_diretor_turma: false,
      }))
      setTeacherStep(0)
      setTab("gerenciar")
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Falha ao criar professor", "error")
    } finally {
      setTeacherSubmitting(false)
    }
  }

  const handleCopyCredentials = async () => {
    if (!lastCredentials) return
    const payload = `Email: ${lastCredentials.email}\nSenha temporária: ${lastCredentials.senha}`
    try {
      await navigator.clipboard.writeText(payload)
      showToast("Credenciais copiadas", "success")
    } catch {
      showToast("Falha ao copiar credenciais", "error")
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem("lastTeacherCredentials")
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { email: string; senha: string }
        if (parsed?.email && parsed?.senha) setLastCredentials(parsed)
      } catch {
        localStorage.removeItem("lastTeacherCredentials")
      }
    }
  }, [])

  const validateTeacherStep = (step: number) => {
    if (step === 0) {
      if (!teacherForm.nome_completo.trim()) return "Informe o nome completo"
      if (!teacherForm.email.trim()) return "Informe o email"
      if (!teacherForm.data_nascimento) return "Informe a data de nascimento"
      if (!teacherForm.numero_bi.trim()) return "Informe o número de BI"
      if (!/^[A-Za-z0-9]{14}$/.test(teacherForm.numero_bi.trim())) {
        return "O BI deve ter 14 caracteres alfanuméricos"
      }
      if (!teacherForm.telefone_principal.trim()) return "Informe o telefone"
    }
    if (step === 1) {
      if (!teacherForm.habilitacoes) return "Informe as habilitações"
      if (!teacherForm.vinculo_contratual) return "Informe o vínculo contratual"
    }
    if (step === 2) {
      if (!teacherForm.carga_horaria_maxima || teacherForm.carga_horaria_maxima <= 0) {
        return "Informe a carga horária máxima"
      }
      if (teacherForm.turnos_disponiveis.length === 0) return "Selecione ao menos um turno"
      if (teacherForm.disciplinas_habilitadas.length === 0) return "Selecione ao menos uma disciplina"
    }
    return null
  }

  useEffect(() => {
    if (tab !== "adicionar" && tab !== "gerenciar") return
    let cancelled = false
    const loadCatalogo = async () => {
      try {
        const res = await fetch(`/api/secretaria/disciplinas`, { cache: "no-store" })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar disciplinas")
        const seen = new Map<string, string>()
        for (const item of json.items || []) {
          const id = item.disciplina_id || item.id
          const nome = item.nome || ""
          if (id && !seen.has(id)) seen.set(id, nome)
        }
        if (!cancelled) {
          setDisciplinasCatalogo(Array.from(seen.entries()).map(([id, nome]) => ({ id, nome })))
        }
      } catch {
        if (!cancelled) setDisciplinasCatalogo([])
      }
    }
    loadCatalogo()
    return () => {
      cancelled = true
    }
  }, [tab])

  const openEdit = (prof: Professor) => {
    setEditTarget(prof)
    setEditForm({
      genero: (prof.genero as any) || "M",
      data_nascimento: (prof.data_nascimento as string | null) || "",
      numero_bi: (prof.numero_bi as string | null) || "",
      telefone_principal: prof.telefone_principal || "",
      habilitacoes: (prof.habilitacoes as any) || "Licenciatura",
      area_formacao: prof.area_formacao || "",
      vinculo_contratual: (prof.vinculo_contratual as any) || "Efetivo",
      carga_horaria_maxima: prof.carga_horaria_maxima || 20,
      turnos_disponiveis: prof.turnos_disponiveis || [],
      disciplinas_habilitadas: prof.disciplinas_ids || [],
      is_diretor_turma: Boolean(prof.is_diretor_turma),
    })
    setEditOpen(true)
  }

  const handleResendInvite = async (email: string) => {
    try {
      const res = await fetch(`/api/escolas/${escolaId}/usuarios/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao reenviar convite")
      showToast("Convite reenviado", "success")
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Falha ao reenviar convite", "error")
    }
  }

  const handleResetPassword = async (prof: Professor) => {
    try {
      const res = await fetch(`/api/escolas/${escolaId}/professores/${prof.user_id}/reset-password`, {
        method: "POST",
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao gerar senha")
      const senhaTemp = json?.senha_temp as string | null
      if (senhaTemp) {
        const creds = { email: prof.email, senha: senhaTemp }
        setLastCredentials(creds)
        localStorage.setItem("lastTeacherCredentials", JSON.stringify(creds))
      }
      showToast("Senha temporária gerada", "success")
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Falha ao gerar senha", "error")
    }
  }

  const handleUpdateProfessor = async () => {
    if (!editTarget) return
    try {
      const res = await fetch(`/api/escolas/${escolaId}/professores/${editTarget.user_id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editForm,
          carga_horaria_maxima: Number(editForm.carga_horaria_maxima),
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao atualizar professor")
      showToast("Professor atualizado", "success")
      setEditOpen(false)
      setEditTarget(null)
      setRefreshToken((prev) => prev + 1)
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Falha ao atualizar professor", "error")
    }
  }

  useEffect(() => {
    if (!escolaId || !atribTurmaId) {
      setDisciplinas([])
      setAtribDisciplinaId("")
      return
    }
    let cancelled = false
    const loadDisciplinas = async () => {
      try {
        const res = await fetch(`/api/escolas/${escolaId}/turmas/${atribTurmaId}/disciplinas`, { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (!res.ok || !Array.isArray(json?.items)) throw new Error(json?.error || 'Falha ao carregar disciplinas')
        if (!cancelled) {
          const list = (json.items as any[])
            .map((d: any) => ({
              id: d.curso_matriz_id ?? d.disciplina?.id,
              nome: d.disciplina?.nome ?? 'Sem disciplina',
              catalogoId: d.disciplina?.id ?? null,
            }))
            .filter((d: any) => Boolean(d.id))
          setDisciplinas(list)
        }
      } catch {
        if (!cancelled) setDisciplinas([])
      }
    }
    loadDisciplinas()
    return () => {
      cancelled = true
    }
  }, [atribTurmaId, escolaId])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-klasse-gold/40 hover:text-slate-900"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Voltar
          </button>
          <h1 className="text-3xl font-bold text-klasse-green">
            Gerenciamento de Professores
          </h1>
        </div>
        <div className="flex text-sm text-slate-400">
          <span>Início</span>
          <span className="mx-2">/</span>
          <span className="font-semibold text-klasse-gold">Professores</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total */}
        <div className="flex items-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-xl bg-klasse-gold/10 text-klasse-gold">
            <UsersIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900">
              {loading ? "—" : professores.length}
            </h3>
            <p className="text-sm text-slate-500">Total de Professores</p>
          </div>
        </div>
        {/* Ativos */}
        <div className="flex items-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-xl bg-klasse-green/10 text-klasse-green">
            <CheckCircleIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900">
              {loading ? "—" : ativos}
            </h3>
            <p className="text-sm text-slate-500">Professores Ativos</p>
          </div>
        </div>
        {/* Pendentes */}
        <div className="flex items-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <ExclamationCircleIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900">
              {loading ? "—" : pendentes}
            </h3>
            <p className="text-sm text-slate-500">Pendentes de Ativação</p>
          </div>
        </div>
        {/* Cursos */}
        <div className="flex items-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-xl bg-klasse-gold/10 text-klasse-gold">
            <Cog6ToothIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900">
              {loading ? "—" : cursos.length}
            </h3>
            <p className="text-sm text-slate-500">Disciplinas (Cursos) Ativas</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {["adicionar", "atribuir", "gerenciar"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`px-6 py-3 font-medium relative ${
              tab === t
                ? "text-klasse-gold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {tab === t && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-klasse-gold" />
            )}
          </button>
        ))}
      </div>

      {/* Tab: Adicionar */}
      {tab === "adicionar" && (
        <div className="space-y-6">
          {/* Formulário */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center border-b border-slate-100 pb-4">
              <UserPlusIcon className="mr-2 h-6 w-6 text-klasse-gold" />
              <h2 className="text-lg font-semibold text-klasse-green">Novo Professor</h2>
            </div>
            <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
              {["Dados pessoais", "Formação", "Disponibilidade"].map((label, idx) => (
                <div key={label} className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] ${
                      teacherStep === idx
                        ? "border-klasse-gold bg-klasse-gold text-white"
                        : "border-slate-200 text-slate-400"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className={teacherStep === idx ? "text-klasse-gold" : "text-slate-400"}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {teacherStep === 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                  placeholder="Nome completo"
                  value={teacherForm.nome_completo}
                  onChange={(e) => updateTeacherForm("nome_completo", e.target.value)}
                />
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                  value={teacherForm.genero}
                  onChange={(e) => updateTeacherForm("genero", e.target.value)}
                >
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                  value={teacherForm.data_nascimento}
                  onChange={(e) => updateTeacherForm("data_nascimento", e.target.value)}
                />
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                  placeholder="Número do BI"
                  value={teacherForm.numero_bi}
                  maxLength={14}
                  onChange={(e) => updateTeacherForm("numero_bi", e.target.value)}
                />
                <p className="md:col-span-2 text-xs text-slate-400">BI deve ter 14 caracteres alfanuméricos.</p>
                <input
                  type="email"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                  placeholder="Email institucional"
                  value={teacherForm.email}
                  onChange={(e) => updateTeacherForm("email", e.target.value)}
                />
                <input
                  type="tel"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                  placeholder="Telefone principal"
                  value={teacherForm.telefone_principal}
                  onChange={(e) => updateTeacherForm("telefone_principal", e.target.value)}
                />
              </div>
            )}

            {teacherStep === 1 && (
              <div className="grid gap-4 md:grid-cols-2">
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                  value={teacherForm.habilitacoes}
                  onChange={(e) => updateTeacherForm("habilitacoes", e.target.value)}
                >
                  {[
                    "Ensino Médio",
                    "Bacharelato",
                    "Licenciatura",
                    "Mestrado",
                    "Doutoramento",
                  ].map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                  placeholder="Área de formação"
                  value={teacherForm.area_formacao}
                  onChange={(e) => updateTeacherForm("area_formacao", e.target.value)}
                />
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                  value={teacherForm.vinculo_contratual}
                  onChange={(e) => updateTeacherForm("vinculo_contratual", e.target.value)}
                >
                  {[
                    "Efetivo",
                    "Colaborador",
                    "Eventual",
                  ].map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            )}

          {teacherStep === 2 && (
            <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    type="number"
                    min={1}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                    placeholder="Carga horária máxima (tempos/semana)"
                    value={teacherForm.carga_horaria_maxima}
                    onChange={(e) => updateTeacherForm("carga_horaria_maxima", Number(e.target.value))}
                  />
                  <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                    {(["Manhã", "Tarde", "Noite"] as const).map((turno) => (
                      <label key={turno} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={teacherForm.turnos_disponiveis.includes(turno)}
                          onChange={(e) => {
                            const next = new Set(teacherForm.turnos_disponiveis)
                            if (e.target.checked) next.add(turno)
                            else next.delete(turno)
                            updateTeacherForm("turnos_disponiveis", Array.from(next))
                          }}
                        />
                        <span>{turno}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Disciplinas habilitadas</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {disciplinasCatalogo.length === 0 && (
                      <span className="text-xs text-slate-400">Nenhuma disciplina disponível.</span>
                    )}
                    {disciplinasCatalogo.map((disc) => (
                      <label key={disc.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={teacherForm.disciplinas_habilitadas.includes(disc.id)}
                          onChange={(e) => {
                            const next = new Set(teacherForm.disciplinas_habilitadas)
                            if (e.target.checked) next.add(disc.id)
                            else next.delete(disc.id)
                            updateTeacherForm("disciplinas_habilitadas", Array.from(next))
                          }}
                        />
                        <span>{disc.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={teacherForm.is_diretor_turma}
                    onChange={(e) => updateTeacherForm("is_diretor_turma", e.target.checked)}
                  />
                  <span>Professor pode ser Diretor de Turma</span>
                </label>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                disabled={teacherStep === 0}
                onClick={() => setTeacherStep((prev) => Math.max(0, prev - 1))}
              >
                Voltar
              </button>
              {teacherStep < 2 ? (
                <button
                  type="button"
                  className="rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
                  onClick={() => {
                    const error = validateTeacherStep(teacherStep)
                    if (error) return showToast(error, "error")
                    setTeacherStep((prev) => Math.min(2, prev + 1))
                  }}
                >
                  Próximo
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
                  disabled={teacherSubmitting}
                  onClick={() => {
                    const error = validateTeacherStep(teacherStep)
                    if (error) return showToast(error, "error")
                    handleCreateProfessor()
                  }}
                >
                  {teacherSubmitting ? "Salvando..." : "Salvar Professor"}
                </button>
              )}
            </div>
            {lastCredentials && (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="font-semibold">Credenciais geradas</div>
                <div className="mt-1">Email: {lastCredentials.email}</div>
                <div>Senha temporária: {lastCredentials.senha}</div>
                <button
                  type="button"
                  className="mt-3 rounded-lg border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-700"
                  onClick={handleCopyCredentials}
                >
                  Copiar credenciais
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Atribuir */}
      {tab === "atribuir" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center border-b border-slate-100 pb-4">
            <ClipboardDocumentListIcon className="mr-2 h-6 w-6 text-klasse-gold" />
            <h2 className="text-lg font-semibold text-klasse-green">Atribuir Professor</h2>
          </div>
          <form onSubmit={handleSubmitAtribuir} className="space-y-4">
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
              required
              value={atribProfessorUserId}
              onChange={(e)=>setAtribProfessorUserId(e.target.value)}
            >
              <option value="">Selecione um professor</option>
              {(() => {
                const selectedDisc = disciplinas.find((d) => d.id === atribDisciplinaId)
                const selectedCatalogoId = selectedDisc?.catalogoId || null
                const list = selectedCatalogoId
                  ? professores.filter((p) => p.disciplinas_ids?.includes(selectedCatalogoId))
                  : professores
                return list.map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.nome || p.email}
                  </option>
                ))
              })()}
            </select>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
              required
              value={atribCursoId}
              onChange={(e)=>setAtribCursoId(e.target.value)}
            >
              <option value="">Selecione um curso</option>
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
              required
              value={atribTurmaId}
              onChange={(e)=>{setAtribTurmaId(e.target.value); loadTurmaAssignments(e.target.value)}}
            >
              <option value="">Selecione uma turma</option>
              {turmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {((t as any).turma_codigo || t.nome) ?? "Turma"}
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
              required
              value={atribDisciplinaId}
              onChange={(e)=>setAtribDisciplinaId(e.target.value)}
              disabled={!atribTurmaId}
            >
              <option value="">{atribTurmaId ? "Selecione uma disciplina" : "Selecione uma turma primeiro"}</option>
              {disciplinas.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={atribuindo}
              className="rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
            >
              {atribuindo ? 'Salvando...' : 'Confirmar Atribuição'}
            </button>
          </form>

          {/* Lista de atribuições da turma selecionada */}
          {atribTurmaId && (
            <div className="mt-8">
              <h3 className="mb-3 font-semibold text-klasse-green">Atribuições da Turma</h3>
              {turmaAssignments === null ? (
                <div className="text-sm text-slate-500">Selecione uma turma para visualizar.</div>
              ) : turmaAssignments.length === 0 ? (
                <div className="text-sm text-slate-500">Nenhuma atribuição encontrada.</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="p-2 text-left">Disciplina</th>
                        <th className="p-2 text-left">Professor</th>
                        <th className="p-2 text-left">Vínculos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {turmaAssignments.map((a: any) => (
                        <tr key={a.id}>
                          <td className="p-2 text-slate-700">{a.disciplina?.nome || a.disciplina?.id}</td>
                          <td className="p-2 text-slate-700">{a.professor?.nome || a.professor?.email || a.professor?.id}</td>
                          <td className="p-2">
                            <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs ${a.vinculos.horarios ? 'bg-klasse-green/10 text-klasse-green' : 'bg-slate-100 text-slate-600'}`}>Horários</span>
                            <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs ${a.vinculos.notas ? 'bg-klasse-green/10 text-klasse-green' : 'bg-slate-100 text-slate-600'}`}>Notas</span>
                            <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs ${a.vinculos.presencas ? 'bg-klasse-green/10 text-klasse-green' : 'bg-slate-100 text-slate-600'}`}>Presenças</span>
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${a.vinculos.planejamento ? 'bg-klasse-green/10 text-klasse-green' : 'bg-slate-100 text-slate-600'}`}>Planejamento</span>
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
                              className="ml-2 inline-flex items-center rounded border border-rose-200 px-2 py-0.5 text-rose-600 hover:bg-rose-50"
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
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center border-b border-slate-100 pb-4">
            <Cog6ToothIcon className="mr-2 h-6 w-6 text-klasse-gold" />
            <h2 className="text-lg font-semibold text-klasse-green">Gerenciar Professores</h2>
          </div>
          {lastCredentials && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <div className="font-semibold">Credenciais geradas</div>
              <div className="mt-1">Email: {lastCredentials.email}</div>
              <div>Senha temporária: {lastCredentials.senha}</div>
              <button
                type="button"
                className="mt-3 rounded-lg border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-700"
                onClick={handleCopyCredentials}
              >
                Copiar credenciais
              </button>
            </div>
          )}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {professores.map((p) => (
              <div
                key={p.user_id}
                className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm"
              >
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                    p.nome || p.email
                  )}&background=0B2C45&color=fff`}
                  alt={p.nome || p.email}
                  className="mx-auto mb-3 h-20 w-20 rounded-full border-4 border-klasse-gold/40"
                />
                <h3 className="font-semibold text-slate-900">
                  {p.nome || "Sem nome"}
                </h3>
                <p className="text-sm text-slate-500">{p.email}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {p.disciplinas && p.disciplinas.length > 0
                    ? `Disciplinas: ${p.disciplinas.join(', ')}`
                    : "Disciplinas: não definidas"}
                </p>
                <span
                  className={`inline-block mt-2 px-3 py-1 text-xs rounded-full ${
                    p.last_login
                      ? "bg-klasse-green/10 text-klasse-green"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {p.last_login ? "Ativo" : "Pendente"}
                </span>
                <div className="mt-4 flex justify-center gap-2">
                  <button
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 hover:border-klasse-gold/40 hover:text-slate-900"
                    onClick={() => openEdit(p)}
                  >
                    Editar
                  </button>
                  {!p.last_login && (
                    <button
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 hover:border-klasse-gold/40 hover:text-slate-900"
                      onClick={() => handleResendInvite(p.email)}
                    >
                      Reenviar convite
                    </button>
                  )}
                  <button
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 hover:border-klasse-gold/40 hover:text-slate-900"
                    onClick={() => handleResetPassword(p)}
                  >
                    Gerar nova senha
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-slate-200 pt-6 text-center text-sm text-slate-400">
        KLASSE • Gestão escolar em escala • © 2025
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-6 top-6 flex items-start space-x-3 rounded-xl border-l-4 bg-white p-4 shadow-lg transition ${
            toast.type === "success" ? "border-klasse-green" : "border-rose-500"
          }`}
        >
          <div>
            {toast.type === "success" ? (
              <CheckCircleIcon className="h-6 w-6 text-klasse-green" />
            ) : (
              <ExclamationCircleIcon className="h-6 w-6 text-rose-500" />
            )}
          </div>
          <div>
            <div className="font-semibold">
              {toast.type === "success" ? "Sucesso" : "Erro"}
            </div>
            <div className="text-sm text-slate-600">{toast.message}</div>
          </div>
        </div>
      )}
      {editOpen && editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-klasse-green">Editar Professor</h3>
              <button
                className="text-slate-400 hover:text-slate-600"
                onClick={() => setEditOpen(false)}
              >
                Fechar
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                value={editForm.data_nascimento}
                onChange={(e) => setEditForm((prev) => ({ ...prev, data_nascimento: e.target.value }))}
              />
              <input
                type="text"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                placeholder="Número do BI"
                value={editForm.numero_bi}
                maxLength={14}
                onChange={(e) => setEditForm((prev) => ({ ...prev, numero_bi: e.target.value }))}
              />
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                value={editForm.genero}
                onChange={(e) => setEditForm((prev) => ({ ...prev, genero: e.target.value as any }))}
              >
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
              <input
                type="tel"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                placeholder="Telefone principal"
                value={editForm.telefone_principal}
                onChange={(e) => setEditForm((prev) => ({ ...prev, telefone_principal: e.target.value }))}
              />
              <input
                type="number"
                min={1}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                placeholder="Carga horária máxima"
                value={editForm.carga_horaria_maxima}
                onChange={(e) => setEditForm((prev) => ({ ...prev, carga_horaria_maxima: Number(e.target.value) }))}
              />
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                value={editForm.habilitacoes}
                onChange={(e) => setEditForm((prev) => ({ ...prev, habilitacoes: e.target.value as any }))}
              >
                {[
                  "Ensino Médio",
                  "Bacharelato",
                  "Licenciatura",
                  "Mestrado",
                  "Doutoramento",
                ].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                placeholder="Área de formação"
                value={editForm.area_formacao}
                onChange={(e) => setEditForm((prev) => ({ ...prev, area_formacao: e.target.value }))}
              />
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                value={editForm.vinculo_contratual}
                onChange={(e) => setEditForm((prev) => ({ ...prev, vinculo_contratual: e.target.value as any }))}
              >
                {[
                  "Efetivo",
                  "Colaborador",
                  "Eventual",
                ].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                {(["Manhã", "Tarde", "Noite"] as const).map((turno) => (
                  <label key={turno} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editForm.turnos_disponiveis.includes(turno)}
                      onChange={(e) => {
                        const next = new Set(editForm.turnos_disponiveis)
                        if (e.target.checked) next.add(turno)
                        else next.delete(turno)
                        setEditForm((prev) => ({ ...prev, turnos_disponiveis: Array.from(next) }))
                      }}
                    />
                    <span>{turno}</span>
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.is_diretor_turma}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, is_diretor_turma: e.target.checked }))}
                />
                <span>Professor pode ser Diretor de Turma</span>
              </label>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Disciplinas habilitadas</p>
              <div className="grid gap-2 md:grid-cols-2">
                {disciplinasCatalogo.map((disc) => (
                  <label key={disc.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.disciplinas_habilitadas.includes(disc.id)}
                      onChange={(e) => {
                        const next = new Set(editForm.disciplinas_habilitadas)
                        if (e.target.checked) next.add(disc.id)
                        else next.delete(disc.id)
                        setEditForm((prev) => ({ ...prev, disciplinas_habilitadas: Array.from(next) }))
                      }}
                    />
                    <span>{disc.nome}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                onClick={() => setEditOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
                onClick={handleUpdateProfessor}
              >
                Salvar alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
