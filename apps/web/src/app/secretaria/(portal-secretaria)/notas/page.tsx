"use client"

import { useEffect, useMemo, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { GradeEntryGrid, type StudentGradeRow } from "@/components/professor/GradeEntryGrid"
import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { formatTurmaDisplayName, formatTurnoDisplay } from "@/utils/formatters"
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context"

type TurmaItem = {
  id: string
  turma_nome?: string | null
  nome?: string | null
  turno?: string | null
  classe_nome?: string | null
}

type DisciplinaItem = {
  id: string
  disciplina?: { id?: string | null; nome?: string | null } | null
  meta?: { periodos_ativos?: number[] | null } | null
}

type PeriodoItem = {
  id: string
  numero: number
}

type PautaDetalhadaRow = {
  aluno_id: string
  nome: string
  foto?: string | null
  numero_chamada?: number | null
  mac?: number | null
  npp?: number | null
  npt?: number | null
  mt?: number | null
}

export default function SecretariaNotasPage() {
  return (
    <Suspense fallback={
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="animate-pulse bg-slate-200 h-10 w-48 rounded mb-6" />
        <div className="grid md:grid-cols-3 gap-3">
          <div className="h-10 bg-slate-100 rounded" />
          <div className="h-10 bg-slate-100 rounded" />
          <div className="h-10 bg-slate-100 rounded" />
        </div>
      </div>
    }>
      <SecretariaNotasContent />
    </Suspense>
  )
}

function SecretariaNotasContent() {
  const searchParams = useSearchParams()
  const academicYearId = searchParams?.get(ACADEMIC_YEAR_PARAM)
  const initialTurmaId = searchParams?.get("turmaId") ?? ""
  const initialDisciplinaId = searchParams?.get("disciplinaId") ?? ""
  const [academicMode, setAcademicMode] = useState<"CURRENT" | "HISTORICAL_READ" | null>(null)
  const [academicContextError, setAcademicContextError] = useState<string | null>(null)
  const [turmas, setTurmas] = useState<TurmaItem[]>([])
  const [disciplinas, setDisciplinas] = useState<DisciplinaItem[]>([])
  const [periodos, setPeriodos] = useState<PeriodoItem[]>([])
  const [periodoNumero, setPeriodoNumero] = useState<number>(1)
  const [turmaId, setTurmaId] = useState(initialTurmaId)
  const [disciplinaId, setDisciplinaId] = useState(initialDisciplinaId)
  const [turmaDisciplinaId, setTurmaDisciplinaId] = useState<string | null>(null)
  const [disciplinaNome, setDisciplinaNome] = useState<string | null>(null)
  const [pauta, setPauta] = useState<StudentGradeRow[]>([])
  const [pautaPesoPorTipo, setPautaPesoPorTipo] = useState<Record<string, number>>({})
  const [pautaComponentes, setPautaComponentes] = useState<string[]>([])
  const [pautaNotaMaxima, setPautaNotaMaxima] = useState<number | null>(20)
  const [pautaNotaCorte, setPautaNotaCorte] = useState<number | null>(10)
  const [pautaEscala, setPautaEscala] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    setAcademicMode(null)
    setAcademicContextError(null)

    if (!academicYearId) {
      setTurmas([])
      return () => {
        active = false
      }
    }

    void fetch(`/api/academic-context?${ACADEMIC_YEAR_PARAM}=${encodeURIComponent(academicYearId)}`, {
      cache: "no-store",
    })
      .then((response) => response.json().then((payload) => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!active) return
        if (!response.ok || !payload?.ok) {
          setAcademicContextError(payload?.error || "Não foi possível identificar o ano letivo.")
          return
        }
        setAcademicMode(payload.context?.mode === "CURRENT" ? "CURRENT" : "HISTORICAL_READ")
      })
      .catch(() => {
        if (active) setAcademicContextError("Não foi possível identificar o ano letivo.")
      })

    return () => {
      active = false
    }
  }, [academicYearId])

  useEffect(() => {
    let active = true
    if (!academicYearId) {
      setTurmas([])
      return () => {
        active = false
      }
    }

    const load = async () => {
      const params = new URLSearchParams({ session_id: academicYearId })
      const res = await fetch(`/api/secretaria/turmas-simples?${params.toString()}`, { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (!active) return
      if (res.ok && json.ok) {
        setTurmas(json.items || json.data || [])
      } else {
        setTurmas([])
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [academicYearId])

  useEffect(() => {
    if (!turmaId) {
      setDisciplinas([])
      setDisciplinaId("")
      setTurmaDisciplinaId(null)
      setPeriodos([])
      return
    }

    let active = true
    const load = async () => {
      const res = await fetch(`/api/secretaria/turmas/${turmaId}/disciplinas`, { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (!active) return
      if (res.ok && json.ok) {
        setDisciplinas(json.items || [])
        setPeriodos(json.periodos || [])
        const firstNumero = json.periodos?.[0]?.numero
        if (typeof firstNumero === "number") {
          setPeriodoNumero(firstNumero)
        }
        if (disciplinaId) {
          const selected = (json.items || []).find((disc: DisciplinaItem) => disc.disciplina?.id === disciplinaId)
          setTurmaDisciplinaId(selected?.id ?? null)
          setDisciplinaNome(selected?.disciplina?.nome ?? null)
        }
      } else {
        setDisciplinas([])
        setPeriodos([])
      }
    }
    load()
    return () => {
      active = false
    }
  }, [turmaId])

  const disciplinasFiltradas = useMemo(() => {
    return disciplinas.filter((disciplina) => {
      const periodosAtivos = disciplina.meta?.periodos_ativos
      if (!periodosAtivos || periodosAtivos.length === 0) return true
      return periodosAtivos.includes(periodoNumero)
    })
  }, [disciplinas, periodoNumero])

  useEffect(() => {
    if (!disciplinaId) return
    const stillValid = disciplinasFiltradas.some((disc) => disc.disciplina?.id === disciplinaId)
    if (!stillValid) setDisciplinaId("")
  }, [disciplinaId, disciplinasFiltradas])

  useEffect(() => {
    if (!academicYearId || !turmaId || !disciplinaId || !turmaDisciplinaId) {
      setPauta([])
      setPautaPesoPorTipo({})
      setPautaComponentes([])
      setPautaNotaMaxima(20)
      setPautaNotaCorte(10)
      setPautaEscala(null)
      return
    }
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          disciplinaId,
          trimestre: String(periodoNumero),
          anoLetivoId: academicYearId,
          turmaDisciplinaId,
        })
        const res = await fetch(`/api/secretaria/turmas/${turmaId}/pauta-grid?${params.toString()}`, {
          cache: "no-store",
        })
        const json = await res.json().catch(() => ({}))
        if (!active) return
        if (res.ok && json.ok && Array.isArray(json.items)) {
          setPauta(
            (json.items as any[]).map((row, index) => ({
              id: row.aluno_id,
              numero: row.numero_chamada ?? index + 1,
              nome: row.nome,
              foto: row.foto ?? null,
              mac1: row.mac ?? null,
              npp1: row.npp ?? null,
              npt1: row.npt ?? null,
              mt1: row.mt ?? null,
              is_isento: !!row.is_isento,
              _status: "synced",
            }))
          )
          setPautaPesoPorTipo((json.meta?.peso_por_tipo as Record<string, number>) ?? {})
          setPautaComponentes(Array.isArray(json.meta?.componentes_ativos) ? json.meta.componentes_ativos : [])
          setPautaNotaMaxima(typeof json.meta?.nota_maxima === "number" ? json.meta.nota_maxima : null)
          setPautaNotaCorte(typeof json.meta?.nota_corte === "number" ? json.meta.nota_corte : null)
          setPautaEscala(typeof json.meta?.escala === "string" ? json.meta.escala : null)
        } else {
          setPauta([])
          setPautaPesoPorTipo({})
          setPautaComponentes([])
          setPautaNotaMaxima(20)
          setPautaNotaCorte(10)
          setPautaEscala(null)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [academicYearId, turmaId, disciplinaId, turmaDisciplinaId, periodoNumero])

  const handleSaveBatch = async (rows: StudentGradeRow[]) => {
    if (!academicYearId || !turmaId || !disciplinaId || !turmaDisciplinaId) return
    if (academicMode !== "CURRENT") {
      throw new Error("Este ano letivo está disponível apenas para consulta.")
    }
    if (pautaNotaMaxima === null) {
      throw new Error("Esta turma usa uma escala não numérica.")
    }

    const configured = new Set(pautaComponentes.map((tipo) => tipo.toUpperCase()))
    const candidates = [
      { tipo: "MAC", campo: "mac1" as const },
      { tipo: "NPP", campo: "npp1" as const },
      { tipo: "NPT", campo: "npt1" as const },
    ]
    const payloads = configured.size === 0
      ? candidates.filter((item) => item.tipo !== "NPP")
      : candidates.filter(
          (item) => configured.has(item.tipo) || (item.tipo === "NPT" && configured.has("PT")),
        )

    const postNotas = async (params: {
      tipo: string
      isIsento: boolean
      notas: Array<{ aluno_id: string; valor: number | null }>
    }) => {
      if (params.notas.length === 0) return
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`

      const response = await fetch("/api/secretaria/notas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          turma_id: turmaId,
          ano_letivo_id: academicYearId,
          disciplina_id: disciplinaId,
          turma_disciplina_id: turmaDisciplinaId,
          trimestre: periodoNumero,
          tipo_avaliacao: params.tipo,
          is_isento: params.isIsento,
          notas: params.notas,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Falha ao guardar notas.")
      }
    }

    const isentos = rows.filter((row) => row.is_isento)
    for (const { tipo } of payloads) {
      await postNotas({
        tipo,
        isIsento: true,
        notas: isentos.map((row) => ({ aluno_id: row.id, valor: null })),
      })
    }

    const activeRows = rows.filter((row) => !row.is_isento)
    for (const { tipo, campo } of payloads) {
      await postNotas({
        tipo,
        isIsento: false,
        notas: activeRows.map((row) => ({
          aluno_id: row.id,
          valor: row[campo] ?? null,
        })),
      })
    }

    setPauta((prev) =>
      prev.map((row) => {
        const updated = rows.find((candidate) => candidate.id === row.id)
        return updated ? { ...row, ...updated, _status: "synced" } : row
      }),
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <DashboardHeader
          title="Lançamento de Notas"
          description="Pauta reativa da secretaria."
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Secretaria", href: "/secretaria" },
            { label: "Notas" },
          ]}
        />
      </div>

      {academicContextError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {academicContextError}
        </div>
      ) : null}
      {academicMode === "HISTORICAL_READ" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Ano letivo em consulta histórica. As notas podem ser consultadas, mas não alteradas.
        </div>
      ) : null}
      {pautaEscala && pautaNotaMaxima === null ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Esta turma usa uma escala não numérica. O lançamento quantitativo está indisponível.
        </div>
      ) : null}

      <div className="grid md:grid-cols-2 gap-3 items-center">
        <select
          value={turmaId}
          onChange={(event) => {
            setTurmaId(event.target.value)
            setDisciplinaId("")
            setTurmaDisciplinaId(null)
            setDisciplinaNome(null)
            setPauta([])
          }}
          className="border rounded p-2"
        >
          <option value="">Selecione a turma</option>
          {turmas.map((turma) => {
            const label = formatTurmaDisplayName(turma)
            const meta = [turma.classe_nome, formatTurnoDisplay(turma.turno)].filter(Boolean).join(" • ")
            return (
              <option key={turma.id} value={turma.id}>
                {meta ? `${label} (${meta})` : label}
              </option>
            )
          })}
        </select>
        <select
          value={disciplinaId}
          onChange={(event) => {
            const nextId = event.target.value
            setDisciplinaId(nextId)
            const selected = disciplinasFiltradas.find((disc) => disc.disciplina?.id === nextId)
            setTurmaDisciplinaId(selected?.id ?? null)
            setDisciplinaNome(selected?.disciplina?.nome ?? null)
          }}
          className="border rounded p-2"
          disabled={!turmaId}
        >
          <option value="">Selecione a disciplina</option>
          {disciplinasFiltradas.map((disciplina) => (
            <option key={disciplina.id} value={disciplina.disciplina?.id ?? ""}>
              {disciplina.disciplina?.nome ?? "Disciplina"}
            </option>
          ))}
        </select>
      </div>

      <div className="grid md:grid-cols-[1fr] gap-3 items-center">
        <select
          value={periodoNumero}
          onChange={(event) => setPeriodoNumero(Number(event.target.value))}
          className="border rounded p-2"
          disabled={!turmaId || periodos.length === 0}
        >
          {periodos.length === 0 && <option value={periodoNumero}>Sem períodos</option>}
          {periodos.map((periodo) => (
            <option key={periodo.id} value={periodo.numero}>
              {`Trimestre ${periodo.numero}`}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="rounded border bg-white p-4 text-sm text-slate-500">Carregando pauta...</div>
      ) : pauta.length === 0 ? (
        <div className="rounded border bg-white p-4 text-sm text-slate-500">
          Selecione a turma e disciplina para carregar os alunos.
        </div>
      ) : (
        <GradeEntryGrid
          initialData={pauta}
          subtitle={`${disciplinaNome ?? "Disciplina"} • Trimestre ${periodoNumero}`}
          onSave={handleSaveBatch}
          showIsento={true}
          componentesAtivos={pautaComponentes}
          pesoPorTipo={pautaPesoPorTipo}
          notaMaxima={pautaNotaMaxima ?? 20}
          notaCorte={pautaNotaCorte ?? 10}
          readOnly={academicMode !== "CURRENT" || pautaNotaMaxima === null}
        />
      )}
    </div>
  )
}
