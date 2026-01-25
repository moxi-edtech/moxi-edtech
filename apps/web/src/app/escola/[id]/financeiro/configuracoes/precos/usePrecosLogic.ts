import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { CURRICULUM_PRESETS_META } from "@/lib/academico/curriculum-presets"

export type Catalogo = { id: string; nome: string; codigo?: string; curso_id?: string }

export type TabelaPrecoItem = {
  id?: string
  escola_id?: string
  ano_letivo: number
  curso_id: string | null
  classe_id: string | null
  valor_matricula: number | null
  valor_mensalidade: number | null
  dia_vencimento: number | null
}

export type ResolvedPreco = {
  tabela: TabelaPrecoItem | null
  origem?: string
}

export type FormState = {
  id?: string
  curso_id: string
  classe_id: string
  valor_matricula: string
  valor_mensalidade: string
  dia_vencimento: string
}

export const initialForm: FormState = {
  curso_id: "",
  classe_id: "",
  valor_matricula: "",
  valor_mensalidade: "",
  dia_vencimento: "",
}

type SessionItem = {
  id: string
  status?: string | null
  ano_letivo?: number | null
  nome?: string | null
  data_inicio?: string | null
  data_fim?: string | null
}

function formatError(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}

function formatCurrencyInput(val: string) {
  if (val === "") return null
  const num = parseFloat(val)
  return Number.isFinite(num) ? num : null
}

export function usePrecosLogic(escolaId: string) {
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [selectedSession, setSelectedSession] = useState<string>("")
  const [anoLetivoFallback, setAnoLetivoFallback] = useState<number>(new Date().getFullYear())
  const [cursos, setCursos] = useState<Catalogo[]>([])
  const [classes, setClasses] = useState<Catalogo[]>([])
  const [tabelas, setTabelas] = useState<TabelaPrecoItem[]>([])
  const [resolved, setResolved] = useState<ResolvedPreco | null>(null)
  const [simulacao, setSimulacao] = useState<{ curso_id: string; classe_id: string }>({ curso_id: "", classe_id: "" })
  const [form, setForm] = useState<FormState>(initialForm)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resolving, setResolving] = useState(false)
  const tabelasRequestRef = useRef(0)
  const simulacaoRequestRef = useRef(0)
  const [classesFiltradasForm, setClassesFiltradasForm] = useState<Catalogo[]>([])

  const deduplicarClassesPorNome = useMemo(() => {
    return (lista: Catalogo[]) => {
      const unicas = lista.filter((cls, index, self) => index === self.findIndex((t) => t.nome === cls.nome))
      return [...unicas].sort((a, b) => a.nome.localeCompare(b.nome, undefined, { numeric: true }))
    }
  }, [])

  const cursoIds = useMemo(() => new Set(cursos.map((c) => c.id)), [cursos])
  const classeIds = useMemo(() => new Set(classes.map((c) => c.id)), [classes])

  const extrairAnoLetivo = (valor?: string | number | null) => {
    if (valor === null || valor === undefined) return null
    if (typeof valor === "number" && Number.isFinite(valor)) return valor
    const texto = String(valor)
    const match = texto.match(/(19|20)\d{2}/)
    if (!match) return null
    return Number(match[0])
  }

  const sessionSelecionada = useMemo(() => sessions.find((s) => s.id === selectedSession), [sessions, selectedSession])

  const anoLetivo = useMemo(() => {
    const candidatos = [
      sessionSelecionada?.ano_letivo,
      sessionSelecionada?.nome,
      sessionSelecionada?.data_inicio,
      sessionSelecionada?.data_fim,
    ]

    for (const candidato of candidatos) {
      const ano = extrairAnoLetivo(candidato)
      if (ano) return ano
    }
    return anoLetivoFallback
  }, [sessionSelecionada, anoLetivoFallback])

  const anoLetivoParam = useMemo(() => {
    if (Number.isFinite(anoLetivo)) return Math.trunc(anoLetivo).toString()
    return new Date().getFullYear().toString()
  }, [anoLetivo])

  const filtrarClassesPorCurso = useMemo(() => {
    return (cursoId: string) => {
    const vinculadasAoCurso = classes.filter((cls) => cls.curso_id === cursoId)
    if (vinculadasAoCurso.length > 0) return deduplicarClassesPorNome(vinculadasAoCurso)

    const cursoSelecionado = cursos.find((c) => c.id === cursoId)
    const cursoCodigo = cursoSelecionado?.codigo as keyof typeof CURRICULUM_PRESETS_META | undefined

    if (cursoCodigo && CURRICULUM_PRESETS_META[cursoCodigo]) {
      const nomesPermitidos = CURRICULUM_PRESETS_META[cursoCodigo].classes || []
      const filtradas = classes.filter((cls) => nomesPermitidos.includes(cls.nome))
      return deduplicarClassesPorNome(filtradas)
    }

    return deduplicarClassesPorNome(classes)
    }
  }, [classes, cursos, deduplicarClassesPorNome])

  useEffect(() => {
    if (!form.curso_id) {
      setClassesFiltradasForm([])
      return
    }

    const filtradas = filtrarClassesPorCurso(form.curso_id)
    setClassesFiltradasForm(filtradas)
    if (form.classe_id && !filtradas.some((c) => c.id === form.classe_id)) {
      setForm((prev) => ({ ...prev, classe_id: "" }))
    }
  }, [form.curso_id, form.classe_id, filtrarClassesPorCurso])

  useEffect(() => {
    const cursoValido = simulacao.curso_id && cursoIds.has(simulacao.curso_id)
    const classeValida = simulacao.classe_id && classeIds.has(simulacao.classe_id)
    const filtradas = filtrarClassesPorCurso(simulacao.curso_id)
    if (simulacao.classe_id && !filtradas.some((c) => c.id === simulacao.classe_id)) {
      setSimulacao((prev) => ({ ...prev, classe_id: "" }))
      return
    }
    if (!cursoValido && !classeValida) return
    simular()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulacao.curso_id, simulacao.classe_id, anoLetivo, cursoIds, classeIds, classes, cursos, filtrarClassesPorCurso])

  const classesFiltradasSimulacao = useMemo(() => {
    if (!simulacao.curso_id) return deduplicarClassesPorNome(classes)
    return filtrarClassesPorCurso(simulacao.curso_id)
  }, [simulacao.curso_id, classes, filtrarClassesPorCurso, deduplicarClassesPorNome])

  const tabelasFiltradas = useMemo(
    () =>
      tabelas.filter((item) => {
        const cursoValido = !item.curso_id || cursoIds.has(item.curso_id)
        const classeValida = !item.classe_id || classeIds.has(item.classe_id)
        return cursoValido && classeValida
      }),
    [tabelas, cursoIds, classeIds]
  )

  const destinosOrdenados = useMemo(() => {
    return [...tabelasFiltradas].sort((a, b) => {
      const aKey = `${a.curso_id || ''}-${a.classe_id || ''}`
      const bKey = `${b.curso_id || ''}-${b.classe_id || ''}`
      return aKey.localeCompare(bKey)
    })
  }, [tabelasFiltradas])

  const destinoAtualLabel = useMemo(() => {
    const cursoIdValido = form.curso_id && cursoIds.has(form.curso_id) ? form.curso_id : ""
    const classeIdValido = form.classe_id && classeIds.has(form.classe_id) ? form.classe_id : ""
    if (!cursoIdValido && !classeIdValido) return "Regra geral (padrão)"
    const cursoNome = cursos.find((c) => c.id === cursoIdValido)?.nome
    const classeNome = classes.find((c) => c.id === classeIdValido)?.nome
    if (cursoIdValido && classeIdValido) return `${cursoNome || 'Curso'} • ${classeNome || 'Classe'}`
    if (cursoIdValido) return cursoNome || "Curso"
    if (classeIdValido) return classeNome || "Classe"
    return "—"
  }, [form.curso_id, form.classe_id, cursos, classes, cursoIds, classeIds])

  const carregarCatalogos = useMemo(() => {
    return async () => {
    try {
      const [cursosRes, classesRes] = await Promise.all([
        fetch(`/api/escolas/${escolaId}/cursos`, { cache: "no-store" }),
        fetch(`/api/escolas/${escolaId}/classes`, { cache: "no-store" }),
      ])

      const cursosJson = await cursosRes.json().catch(() => null)
      const classesJson = await classesRes.json().catch(() => null)
      if (cursosRes.ok && Array.isArray(cursosJson?.data)) {
        const cursosData = cursosJson.data as Catalogo[]
        setCursos(cursosData)
        const faltandoCodigo = cursosData.filter((c) => !c.codigo)
        if (faltandoCodigo.length > 0) {
          console.warn("[Precos] Cursos sem codigo retornado", faltandoCodigo)
        }
      }
      if (classesRes.ok && Array.isArray(classesJson?.data)) setClasses(classesJson.data as Catalogo[])
    } catch (e) {
      console.error(e)
    }
    }
  }, [escolaId])

  const carregarSessions = useMemo(() => {
    return async () => {
    try {
      const res = await fetch("/api/secretaria/school-sessions")
      const json = await res.json().catch(() => null)
      if (!res.ok || !json) return

      const sessionItems = Array.isArray(json.data)
        ? (json.data as SessionItem[])
        : Array.isArray(json.items)
          ? (json.items as SessionItem[])
          : []

      setSessions(sessionItems)
      const active = sessionItems.find((s) => s.status === "ativa")
      if (active) setSelectedSession(active.id)
      else if (sessionItems.length > 0) setSelectedSession(sessionItems[0].id)
    } catch (e) {
      console.error(e)
    }
    }
  }, [])

  const carregarTabelas = useMemo(() => {
    return async () => {
    const requestId = ++tabelasRequestRef.current
    setLoading(true)
    setTabelas([])
    setResolved(null)
    try {
      const res = await fetch(
        `/api/financeiro/tabelas?escola_id=${encodeURIComponent(escolaId)}&ano_letivo=${encodeURIComponent(
          anoLetivoParam
        )}`,
        { cache: "no-store" }
      )
      const json = await res.json().catch(() => null)
      if (tabelasRequestRef.current !== requestId) return
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao carregar preços")
      setTabelas((json.items as TabelaPrecoItem[]) || [])
      setResolved(json.resolved || null)
    } catch (e: unknown) {
      toast.error(formatError(e, "Erro ao carregar tabelas"))
    } finally {
      if (tabelasRequestRef.current === requestId) {
        setLoading(false)
      }
    }
    }
  }, [anoLetivoParam, escolaId])

  const simular = useMemo(() => {
    return async () => {
    const requestId = ++simulacaoRequestRef.current
    setResolving(true)
    const cursoIdValido = simulacao.curso_id && cursoIds.has(simulacao.curso_id) ? simulacao.curso_id : ""
    const classeIdValido = simulacao.classe_id && classeIds.has(simulacao.classe_id) ? simulacao.classe_id : ""
    if (!cursoIdValido && !classeIdValido) {
      setResolved(null)
      setResolving(false)
      return
    }
    try {
      const res = await fetch(
        `/api/financeiro/tabelas?escola_id=${encodeURIComponent(escolaId)}&ano_letivo=${encodeURIComponent(
          anoLetivoParam
        )}&curso_id=${encodeURIComponent(cursoIdValido)}&classe_id=${encodeURIComponent(classeIdValido)}`,
        { cache: "no-store" }
      )
      const json = await res.json().catch(() => null)
      if (simulacaoRequestRef.current !== requestId) return
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao resolver preços")
      setResolved(json.resolved || null)
    } catch (e: unknown) {
      toast.error(formatError(e, "Erro ao simular preço"))
    } finally {
      if (simulacaoRequestRef.current === requestId) {
        setResolving(false)
      }
    }
    }
  }, [anoLetivoParam, cursoIds, classeIds, escolaId, simulacao.curso_id, simulacao.classe_id])

  useEffect(() => {
    carregarCatalogos()
  }, [carregarCatalogos])

  useEffect(() => {
    carregarSessions()
  }, [carregarSessions])

  useEffect(() => {
    carregarTabelas()
  }, [anoLetivo, carregarTabelas])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const anoLetivoNumero = Number(anoLetivoParam) || anoLetivoFallback || new Date().getFullYear()
      const payload: Record<string, unknown> = {
        ano_letivo: anoLetivoNumero,
        curso_id: form.curso_id && cursoIds.has(form.curso_id) ? form.curso_id : null,
        classe_id: form.classe_id && classeIds.has(form.classe_id) ? form.classe_id : null,
        valor_matricula: formatCurrencyInput(form.valor_matricula),
        valor_mensalidade: formatCurrencyInput(form.valor_mensalidade),
        dia_vencimento: form.dia_vencimento === "" ? null : Number(form.dia_vencimento),
      }

      let method: "POST" | "PATCH" = "POST"
      if (form.id) {
        method = "PATCH"
        payload.id = form.id
      } else {
        payload.escola_id = escolaId
      }

      const res = await fetch("/api/financeiro/tabelas", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Erro ao salvar preços")

      toast.success("Tabela salva com sucesso")
      setForm(initialForm)
      carregarTabelas()
    } catch (e: unknown) {
      toast.error(formatError(e, "Falha ao salvar"))
    } finally {
      setSaving(false)
    }
  }

  function editar(item: TabelaPrecoItem) {
    setForm({
      id: item.id,
      curso_id: item.curso_id && cursoIds.has(item.curso_id) ? item.curso_id : "",
      classe_id: item.classe_id && classeIds.has(item.classe_id) ? item.classe_id : "",
      valor_matricula: item.valor_matricula?.toString() || "",
      valor_mensalidade: item.valor_mensalidade?.toString() || "",
      dia_vencimento: item.dia_vencimento?.toString() || "",
    })
  }

  return {
    state: {
      sessions,
      selectedSession,
      anoLetivo,
      anoLetivoFallback,
      cursos,
      classes,
      tabelas,
      resolved,
      simulacao,
      form,
      loading,
      saving,
      resolving,
      classesFiltradasForm,
      classesFiltradasSimulacao,
      destinosOrdenados,
      destinoAtualLabel,
    },
    actions: {
      setSelectedSession,
      setAnoLetivoFallback,
      setForm,
      setSimulacao,
      carregarTabelas,
      simular,
      salvar,
      editar,
    },
  }
}
