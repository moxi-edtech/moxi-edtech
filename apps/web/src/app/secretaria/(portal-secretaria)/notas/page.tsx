"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { GradeEntryGrid, type StudentGradeRow } from "@/components/professor/GradeEntryGrid"

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
  const searchParams = useSearchParams()
  const initialTurmaId = searchParams?.get("turmaId") ?? ""
  const initialDisciplinaId = searchParams?.get("disciplinaId") ?? ""
  const [anoLetivo, setAnoLetivo] = useState<number>(new Date().getFullYear())
  const [turmas, setTurmas] = useState<TurmaItem[]>([])
  const [disciplinas, setDisciplinas] = useState<DisciplinaItem[]>([])
  const [periodos, setPeriodos] = useState<PeriodoItem[]>([])
  const [periodoNumero, setPeriodoNumero] = useState<number>(1)
  const [turmaId, setTurmaId] = useState(initialTurmaId)
  const [disciplinaId, setDisciplinaId] = useState(initialDisciplinaId)
  const [turmaDisciplinaId, setTurmaDisciplinaId] = useState<string | null>(null)
  const [disciplinaNome, setDisciplinaNome] = useState<string | null>(null)
  const [pauta, setPauta] = useState<StudentGradeRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      const params = new URLSearchParams({ ano: String(anoLetivo) })
      const res = await fetch(`/api/secretaria/turmas-simples?${params.toString()}`, { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (!active) return
      if (res.ok && json.ok) {
        setTurmas(json.items || json.data || [])
      } else {
        setTurmas([])
      }
    }
    load()
    return () => {
      active = false
    }
  }, [anoLetivo])

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
    if (!turmaId || !disciplinaId) {
      setPauta([])
      return
    }
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          disciplinaId,
          trimestre: String(periodoNumero),
        })
        const res = await fetch(`/api/secretaria/turmas/${turmaId}/pauta-grid?${params.toString()}`, {
          cache: "no-store",
        })
        const json = await res.json().catch(() => ({}))
        if (!active) return
        if (res.ok && json.ok && Array.isArray(json.items)) {
          setPauta(
            (json.items as PautaDetalhadaRow[]).map((row, index) => ({
              id: row.aluno_id,
              numero: row.numero_chamada ?? index + 1,
              nome: row.nome,
              foto: row.foto ?? null,
              mac1: row.mac ?? null,
              npp1: row.npp ?? null,
              npt1: row.npt ?? null,
              mt1: row.mt ?? null,
              _status: "synced",
            }))
          )
        } else {
          setPauta([])
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [turmaId, disciplinaId, periodoNumero])

  const handleSaveBatch = async (rows: StudentGradeRow[]) => {
    if (!turmaId || !disciplinaId) return
    const payloads = [
      { tipo: "MAC", campo: "mac1" as const },
      { tipo: "NPP", campo: "npp1" as const },
      { tipo: "NPT", campo: "npt1" as const },
    ]

    for (const { tipo, campo } of payloads) {
      const notas = rows
        .map((row) => ({ aluno_id: row.id, valor: row[campo] }))
        .filter((entry) => typeof entry.valor === "number")
      if (notas.length === 0) continue

      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`

      const res = await fetch(`/api/secretaria/notas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          turma_id: turmaId,
          disciplina_id: disciplinaId,
          turma_disciplina_id: turmaDisciplinaId || undefined,
          trimestre: periodoNumero,
          tipo_avaliacao: tipo,
          notas,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao salvar notas")
      }
    }

    setPauta((prev) =>
      prev.map((row) => {
        const updated = rows.find((candidate) => candidate.id === row.id)
        return updated ? { ...row, ...updated, _status: "synced" } : row
      })
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Lançamento de Notas</h1>
        <p className="text-sm text-slate-500">Pauta reativa para secretaria.</p>
      </div>

      <div className="grid md:grid-cols-[1fr_1fr_1fr] gap-3 items-center">
        <input
          type="number"
          value={anoLetivo}
          onChange={(event) => setAnoLetivo(Number(event.target.value))}
          className="border rounded p-2"
        />
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
            const label = turma.turma_nome || turma.nome || "Turma"
            const meta = [turma.classe_nome, turma.turno].filter(Boolean).join(" • ")
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
        />
      )}
    </div>
  )
}
