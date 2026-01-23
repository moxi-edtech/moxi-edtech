"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table"

type Atrib = {
  id: string
  turma_disciplina_id?: string | null
  curso_matriz_id?: string | null
  turma: { id: string; nome: string | null }
  disciplina: { id: string | null; nome: string | null }
}

type PautaAluno = {
  aluno_id: string
  nome: string
  foto?: string | null
  notas?: { t1?: number | null; t2?: number | null; t3?: number | null }
}

type NotaKey = "t1" | "t2" | "t3"

const TRIMESTRES: Array<{ key: NotaKey; label: string; trimestre: number }> = [
  { key: "t1", label: "T1", trimestre: 1 },
  { key: "t2", label: "T2", trimestre: 2 },
  { key: "t3", label: "T3", trimestre: 3 },
]

const NOTA_MIN = 0
const NOTA_MAX = 20

function parseNota(value: string) {
  if (!value.trim()) return null
  const normalized = value.replace(",", ".")
  const num = Number(normalized)
  if (!Number.isFinite(num)) return null
  return num
}

function buildCellKey(alunoId: string, key: NotaKey) {
  return `${alunoId}-${key}`
}

function playErrorTone() {
  if (typeof window === "undefined") return
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = "square"
    oscillator.frequency.value = 220
    gain.gain.value = 0.12
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.15)
    oscillator.onended = () => ctx.close()
  } catch {}
}

export default function ProfessorNotasPage() {
  const searchParams = useSearchParams()
  const highlightAlunoId = searchParams.get("alunoId")

  const [atribs, setAtribs] = useState<Atrib[]>([])
  const [turmaId, setTurmaId] = useState("")
  const [disciplinaId, setDisciplinaId] = useState("")
  const [turmaDisciplinaId, setTurmaDisciplinaId] = useState<string | null>(null)
  const [disciplinaNome, setDisciplinaNome] = useState<string | null>(null)
  const [pauta, setPauta] = useState<PautaAluno[]>([])
  const [loading, setLoading] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingCells, setSavingCells] = useState<Record<string, boolean>>({})
  const [savedCells, setSavedCells] = useState<Record<string, boolean>>({})
  const [invalidCells, setInvalidCells] = useState<Record<string, boolean>>({})

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    let active = true
    const load = async () => {
      const res = await fetch("/api/professor/atribuicoes", { cache: "no-store" })
      const json = await res.json().catch(() => null)
      if (!active) return
      if (res.ok && json?.ok) setAtribs(json.items || [])
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const atribsByTurma = useMemo(() => {
    return atribs.reduce((acc, a) => {
      const list = acc.get(a.turma.id) || []
      list.push(a)
      acc.set(a.turma.id, list)
      return acc
    }, new Map<string, Atrib[]>())
  }, [atribs])

  useEffect(() => {
    if (!turmaId || !disciplinaId) {
      setPauta([])
      return
    }

    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ turmaId, disciplinaId })
        const res = await fetch(`/api/professor/pauta?${params.toString()}`, { cache: "no-store" })
        const json = await res.json().catch(() => null)
        if (!active) return
        if (res.ok && Array.isArray(json)) {
          setPauta(json)
          const nextDrafts: Record<string, string> = {}
          json.forEach((row: PautaAluno) => {
            TRIMESTRES.forEach(({ key }) => {
              const value = row.notas?.[key]
              if (value !== null && value !== undefined) {
                nextDrafts[buildCellKey(row.aluno_id, key)] = String(value)
              }
            })
          })
          setDrafts(nextDrafts)
          setInvalidCells({})
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
  }, [turmaId, disciplinaId])

  const handleSave = async (alunoId: string, key: NotaKey, trimestre: number) => {
    const cellKey = buildCellKey(alunoId, key)
    const raw = drafts[cellKey] ?? ""
    if (!raw.trim()) return

    const valor = parseNota(raw)
    if (valor === null || valor < NOTA_MIN || valor > NOTA_MAX) {
      setInvalidCells((prev) => ({ ...prev, [cellKey]: true }))
      playErrorTone()
      return
    }

    if (!turmaId || !disciplinaId) return

    setSavingCells((prev) => ({ ...prev, [cellKey]: true }))
    try {
      const res = await fetch("/api/professor/notas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turma_id: turmaId,
          disciplina_id: disciplinaId,
          turma_disciplina_id: turmaDisciplinaId || undefined,
          trimestre,
          disciplina_nome: disciplinaNome || undefined,
          notas: [{ aluno_id: alunoId, valor }],
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao salvar nota")

      setPauta((prev) =>
        prev.map((row) =>
          row.aluno_id === alunoId
            ? {
                ...row,
                notas: { ...row.notas, [key]: valor },
              }
            : row
        )
      )
      setSavedCells((prev) => ({ ...prev, [cellKey]: true }))
      setTimeout(() => {
        setSavedCells((prev) => {
          const next = { ...prev }
          delete next[cellKey]
          return next
        })
      }, 1500)
    } catch (err) {
      playErrorTone()
    } finally {
      setSavingCells((prev) => {
        const next = { ...prev }
        delete next[cellKey]
        return next
      })
    }
  }

  const data = useMemo(() => pauta, [pauta])

  const columns = useMemo<ColumnDef<PautaAluno>[]>(() => {
    return [
      {
        header: "Aluno",
        accessorKey: "nome",
        cell: ({ row }) => {
          const original = row.original
          return (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-slate-100 text-xs font-semibold text-slate-600 flex items-center justify-center">
                {original.nome?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-slate-900">{original.nome}</div>
                <div className="text-xs text-slate-500">{original.aluno_id}</div>
              </div>
            </div>
          )
        },
      },
      ...TRIMESTRES.map((t, index) => ({
        header: t.label,
        id: t.key,
        cell: ({ row }) => {
          const alunoId = row.original.aluno_id
          const cellKey = buildCellKey(alunoId, t.key)
          const stored = drafts[cellKey]
          const value = stored ?? (row.original.notas?.[t.key] ?? "")
          const invalid = Boolean(invalidCells[cellKey])
          const saving = Boolean(savingCells[cellKey])
          const saved = Boolean(savedCells[cellKey])
          const rowIndex = row.index
          const colIndex = index

          return (
            <div className="relative">
              <input
                ref={(el) => {
                  inputRefs.current[`${rowIndex}-${colIndex}`] = el
                }}
                type="text"
                inputMode="decimal"
                value={value}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setDrafts((prev) => ({ ...prev, [cellKey]: nextValue }))
                  setInvalidCells((prev) => {
                    const num = parseNota(nextValue)
                    const isInvalid =
                      nextValue.trim() !== "" && (num === null || num < NOTA_MIN || num > NOTA_MAX)
                    if (isInvalid && !prev[cellKey]) playErrorTone()
                    if (!isInvalid && prev[cellKey]) {
                      const next = { ...prev }
                      delete next[cellKey]
                      return next
                    }
                    return isInvalid ? { ...prev, [cellKey]: true } : prev
                  })
                }}
                onBlur={() => handleSave(alunoId, t.key, t.trimestre)}
                onKeyDown={(event) => {
                  if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Enter"].includes(event.key)) {
                    event.preventDefault()
                  }
                  const move = (rowDelta: number, colDelta: number) => {
                    const nextRow = rowIndex + rowDelta
                    const nextCol = colIndex + colDelta
                    const next = inputRefs.current[`${nextRow}-${nextCol}`]
                    if (next) {
                      next.focus()
                      next.select()
                    }
                  }
                  if (event.key === "ArrowDown" || event.key === "Enter") move(1, 0)
                  if (event.key === "ArrowUp") move(-1, 0)
                  if (event.key === "ArrowLeft") move(0, -1)
                  if (event.key === "ArrowRight") move(0, 1)
                }}
                className={`w-20 rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-klasse-green/30 ${
                  invalid
                    ? "border-red-400 bg-red-50 text-red-700"
                    : "border-slate-200 bg-white text-slate-900"
                }`}
              />
              {saving && <span className="absolute -right-5 top-2 text-[10px] text-slate-400">…</span>}
              {saved && <span className="absolute -right-5 top-1.5 text-xs text-green-600">✅</span>}
            </div>
          )
        },
      })),
    ]
  }, [drafts, invalidCells, savingCells, savedCells, disciplinaId, turmaId, turmaDisciplinaId, disciplinaNome])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pauta em Grade</h1>
        <p className="text-sm text-slate-500">
          Digite a nota, pressione Enter ou seta para continuar. Ao sair do campo, a nota é salva automaticamente.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
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
          required
        >
          <option value="">Selecione a turma</option>
          {Array.from(new Set(atribs.map((a) => a.turma.id))).map((tid) => (
            <option key={tid} value={tid}>
              {atribs.find((a) => a.turma.id === tid)?.turma.nome || tid}
            </option>
          ))}
        </select>
        <select
          value={disciplinaId}
          onChange={(event) => {
            const nextId = event.target.value
            setDisciplinaId(nextId)
            const atrib = (atribsByTurma.get(turmaId) || []).find((a) => a.disciplina.id === nextId)
            setTurmaDisciplinaId(atrib?.turma_disciplina_id ?? null)
            setDisciplinaNome(atrib?.disciplina.nome ?? null)
          }}
          className="border rounded p-2"
          required
          disabled={!turmaId}
        >
          <option value="">Selecione a disciplina</option>
          {(atribsByTurma.get(turmaId) || [])
            .filter((a) => a.disciplina.id)
            .map((a) => (
              <option key={a.disciplina.id} value={a.disciplina.id || ""}>
                {a.disciplina.nome || a.disciplina.id}
              </option>
            ))}
        </select>
      </div>

      <div className="rounded border bg-white overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="p-2 font-semibold text-slate-600">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="p-4 text-slate-500">
                  Carregando pauta...
                </td>
              </tr>
            )}
            {!loading && data.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-slate-500">
                  Selecione a turma e disciplina para carregar os alunos.
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={`border-t ${
                  row.original.aluno_id === highlightAlunoId ? "bg-emerald-50" : "hover:bg-slate-50"
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="p-2 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
