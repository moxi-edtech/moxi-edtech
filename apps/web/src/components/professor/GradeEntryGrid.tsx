"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { CheckCircle2, Loader2, Clipboard, AlertCircle, TrendingUp, Users, CheckCircle, HelpCircle } from "lucide-react"
import { SyncIndicator } from "@/components/feedback/FeedbackSystem"

export type StudentGradeRow = {
  id: string
  numero: number
  nome: string
  foto?: string | null
  mac1: number | null
  npp1: number | null
  npt1: number | null
  mt1: number | null
  is_isento?: boolean
  _status: "synced" | "pending" | "error"
}

type GradeEntryGridProps = {
  initialData: StudentGradeRow[]
  title?: string
  subtitle?: string
  debounceMs?: number
  onSave?: (rows: StudentGradeRow[]) => Promise<void> | void
  onSaveError?: (error: unknown) => void
  highlightId?: string | null
  onDataChange?: (rows: StudentGradeRow[]) => void
  pesoPorTipo?: Record<string, number>
  componentesAtivos?: string[]
  showIsento?: boolean
}

const INPUT_COLUMNS = ["mac1", "npp1", "npt1"] as const

const clampNota = (value: string) => {
  const normalized = value.replace(",", ".").trim()
  if (normalized === "") return null
  let parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null

  // Auto-correct common fast-typing decimal omission: e.g. "145" -> 14.5, "185" -> 18.5
  if (parsed > 20 && parsed <= 200 && Number.isInteger(parsed)) {
    parsed = parsed / 10
  }

  return Math.min(20, Math.max(0, Number(parsed.toFixed(1))))
}

const resolveTipoValue = (row: StudentGradeRow, tipo: string) => {
  const normalized = tipo.toUpperCase()
  if (normalized === "MAC") return row.mac1
  if (normalized === "NPP") return row.npp1
  if (normalized === "NPT" || normalized === "PT") return row.npt1
  return null
}

const calculateMT = (
  row: StudentGradeRow,
  pesoPorTipo?: Record<string, number>,
  componentesAtivos?: string[]
) => {
  const tipos = componentesAtivos && componentesAtivos.length > 0
    ? componentesAtivos
    : ["MAC", "NPP", "NPT"]
  const valores = tipos
    .map((tipo) => ({ tipo, valor: resolveTipoValue(row, tipo) }))
    .filter((entry) => typeof entry.valor === "number") as Array<{ tipo: string; valor: number }>

  if (valores.length === 0) return null

  if (pesoPorTipo && Object.keys(pesoPorTipo).length > 0) {
    let weightedSum = 0
    let weightSum = 0
    for (const entry of valores) {
      const peso = Number(pesoPorTipo[entry.tipo.toUpperCase()] ?? 1)
      weightedSum += entry.valor * peso
      weightSum += peso
    }
    if (weightSum > 0) return Number((weightedSum / weightSum).toFixed(1))
  }

  const avg = valores.reduce((acc, cur) => acc + cur.valor, 0) / valores.length
  return Number(avg.toFixed(1))
}

export function GradeEntryGrid({
  initialData,
  title = "Lançamento de Notas",
  subtitle,
  debounceMs = 800,
  onSave,
  onSaveError,
  highlightId,
  onDataChange,
  pesoPorTipo,
  componentesAtivos,
  showIsento = false,
}: GradeEntryGridProps) {
  const [data, setData] = useState<StudentGradeRow[]>(initialData)
  const dataRef = useRef<StudentGradeRow[]>(initialData)
  const [isSaving, setIsSaving] = useState(false)
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pasteColumn, setPasteColumn] = useState<typeof INPUT_COLUMNS[number]>("mac1")
  const [pasteText, setPasteText] = useState("")

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const pendingIdsRef = useRef<Set<string>>(new Set())
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setData(initialData)
  }, [initialData])

  useEffect(() => {
    dataRef.current = data
  }, [data])

  const onDataChangeRef = useRef(onDataChange)

  useEffect(() => {
    onDataChangeRef.current = onDataChange
  }, [onDataChange])

  useEffect(() => {
    onDataChangeRef.current?.(data)
  }, [data])

  // Estatísticas em tempo real da turma
  const stats = useMemo(() => {
    let totalMT = 0
    let countMT = 0
    let aprovados = 0
    let reprovados = 0
    let lancados = 0

    for (const row of data) {
      const hasAny = row.mac1 !== null || row.npp1 !== null || row.npt1 !== null
      if (hasAny) lancados++

      if (row.mt1 !== null) {
        totalMT += row.mt1
        countMT++
        if (row.mt1 >= 10) aprovados++
        else reprovados++
      }
    }

    const mediaTurma = countMT > 0 ? Number((totalMT / countMT).toFixed(1)) : null
    const percAprovados = countMT > 0 ? Math.round((aprovados / countMT) * 100) : 0

    return {
      total: data.length,
      lancados,
      mediaTurma,
      aprovados,
      reprovados,
      percAprovados,
    }
  }, [data])

  const flushSave = useCallback(async () => {
    if (!onSave || pendingIdsRef.current.size === 0) return
    const ids = Array.from(pendingIdsRef.current)
    pendingIdsRef.current.clear()
    const payload = dataRef.current.filter((row) => ids.includes(row.id))
    if (payload.length === 0) return

    setIsSaving(true)
    try {
      await onSave(payload)
      setData((prev) =>
        prev.map((row) =>
          ids.includes(row.id)
            ? {
                ...row,
                _status: "synced",
              }
            : row
        )
      )
  } catch (error) {
      setData((prev) =>
        prev.map((row) =>
          ids.includes(row.id)
            ? {
                ...row,
                _status: "error",
              }
            : row
        )
      )
      onSaveError?.(error)
    } finally {
      setIsSaving(false)
    }
  }, [onSave, onSaveError])

  const scheduleSave = useCallback(() => {
    if (!onSave) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      flushSave().catch(() => null)
    }, debounceMs)
  }, [debounceMs, flushSave, onSave])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  const updateGrade = useCallback(
    (rowIndex: number, columnId: typeof INPUT_COLUMNS[number], value: string) => {
      const numericValue = clampNota(value)
      setData((old) =>
        old.map((row, index) => {
          if (index !== rowIndex) return row
          const updatedRow = {
            ...row,
            [columnId]: numericValue,
            _status: "pending" as const,
          }
          updatedRow.mt1 = calculateMT(updatedRow, pesoPorTipo, componentesAtivos)
          return updatedRow
        })
      )

      const target = data[rowIndex]
      if (target) pendingIdsRef.current.add(target.id)
      scheduleSave()
    },
    [data, scheduleSave, pesoPorTipo, componentesAtivos]
  )

  // Manipulador para colar lote do Excel/Sheets
  const handleBatchPaste = useCallback(
    (startRowIndex: number, columnId: typeof INPUT_COLUMNS[number], rawText: string) => {
      const lines = rawText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

      if (lines.length === 0) return

      setData((old) =>
        old.map((row, index) => {
          if (index < startRowIndex || index >= startRowIndex + lines.length) return row
          const valString = lines[index - startRowIndex]
          const numericValue = valString ? clampNota(valString) : null
          const updatedRow = {
            ...row,
            [columnId]: numericValue,
            _status: "pending" as const,
          }
          updatedRow.mt1 = calculateMT(updatedRow, pesoPorTipo, componentesAtivos)
          pendingIdsRef.current.add(row.id)
          return updatedRow
        })
      )
      scheduleSave()
    },
    [pesoPorTipo, componentesAtivos, scheduleSave]
  )

  const handleApplyPasteModal = () => {
    if (!pasteText.trim()) return
    handleBatchPaste(0, pasteColumn, pasteText)
    setPasteText("")
    setShowPasteModal(false)
  }

  const updateIsento = useCallback(
    (rowIndex: number, checked: boolean) => {
      setData((old) =>
        old.map((row, index) => {
          if (index !== rowIndex) return row
          return {
            ...row,
            is_isento: checked,
            mac1: checked ? null : row.mac1,
            npp1: checked ? null : row.npp1,
            npt1: checked ? null : row.npt1,
            mt1: checked ? null : row.mt1,
            _status: "pending" as const,
          }
        })
      )
      const target = data[rowIndex]
      if (target) pendingIdsRef.current.add(target.id)
      scheduleSave()
    },
    [data, scheduleSave]
  )

  const columnHelper = createColumnHelper<StudentGradeRow>()

  const columns = useMemo(
    () => [
      columnHelper.accessor("numero", {
        header: "Nº",
        size: 40,
        cell: (info) => (
          <span className="font-mono text-slate-400 text-xs font-bold">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("nome", {
        header: "Nome do Aluno",
        size: 240,
        cell: (info) => (
          <div className="flex items-center gap-2 text-left">
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center justify-center shrink-0">
              {info.getValue().charAt(0)}
            </div>
            <span className="font-bold text-slate-900 text-xs truncate max-w-[200px]">{info.getValue()}</span>
          </div>
        ),
      }),
      ...(showIsento ? [
        columnHelper.accessor("is_isento", {
          header: "Isento?",
          size: 60,
          cell: (info: any) => (
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={!!info.getValue()}
                onChange={(e) => updateIsento(info.row.index, e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                title="Marcar como isento neste trimestre"
              />
            </div>
          ),
        })
      ] : []),
      columnHelper.accessor("_status", {
        header: "Status",
        size: 70,
        cell: (info) => {
          const status = info.getValue()
          const mapped = status === "pending" ? "syncing" : status === "error" ? "error" : "synced"
          return <SyncIndicator status={mapped} compact />
        },
      }),
      columnHelper.group({
        header: "Iº TRIMESTRE (Pauta Oficial)",
        columns: [
          columnHelper.accessor("mac1", {
            header: "MAC",
            size: 80,
            cell: ({ row, getValue }) => (
              <GradeInput
                inputRef={(el) => {
                  inputRefs.current[`${row.index}-0`] = el
                }}
                disabled={!!row.original.is_isento}
                value={getValue()}
                onChange={(val) => updateGrade(row.index, "mac1", val)}
                onBatchPaste={(pasteText) => handleBatchPaste(row.index, "mac1", pasteText)}
                onNavigate={(deltaRow, deltaCol) => {
                  const next = inputRefs.current[`${row.index + deltaRow}-${0 + deltaCol}`]
                  if (next) {
                    next.focus()
                    next.select()
                  }
                }}
              />
            ),
          }),
          columnHelper.accessor("npp1", {
            header: "NPP",
            size: 80,
            cell: ({ row, getValue }) => (
              <GradeInput
                inputRef={(el) => {
                  inputRefs.current[`${row.index}-1`] = el
                }}
                disabled={!!row.original.is_isento}
                value={getValue()}
                onChange={(val) => updateGrade(row.index, "npp1", val)}
                onBatchPaste={(pasteText) => handleBatchPaste(row.index, "npp1", pasteText)}
                onNavigate={(deltaRow, deltaCol) => {
                  const next = inputRefs.current[`${row.index + deltaRow}-${1 + deltaCol}`]
                  if (next) {
                    next.focus()
                    next.select()
                  }
                }}
              />
            ),
          }),
          columnHelper.accessor("npt1", {
            header: "NPT",
            size: 80,
            cell: ({ row, getValue }) => (
              <GradeInput
                inputRef={(el) => {
                  inputRefs.current[`${row.index}-2`] = el
                }}
                disabled={!!row.original.is_isento}
                value={getValue()}
                onChange={(val) => updateGrade(row.index, "npt1", val)}
                onBatchPaste={(pasteText) => handleBatchPaste(row.index, "npt1", pasteText)}
                onNavigate={(deltaRow, deltaCol) => {
                  const next = inputRefs.current[`${row.index + deltaRow}-${2 + deltaCol}`]
                  if (next) {
                    next.focus()
                    next.select()
                  }
                }}
              />
            ),
          }),
          columnHelper.accessor("mt1", {
            header: "MT1",
            size: 80,
            cell: (info) => {
              const val = info.getValue()
              if (val === null) return <span className="text-slate-300 font-bold">—</span>
              
              let style = "text-slate-700 bg-slate-100"
              if (val >= 14) style = "text-emerald-700 bg-emerald-50 border border-emerald-200/80"
              else if (val >= 10) style = "text-amber-800 bg-amber-50 border border-amber-200/80"
              else if (val >= 8) style = "text-orange-800 bg-orange-50 border border-orange-200/80"
              else style = "text-rose-700 bg-rose-50 border border-rose-200/80"

              return (
                <span className={`inline-block w-12 py-1 rounded-lg text-xs font-black shadow-2xs ${style}`}>
                  {val}
                </span>
              )
            },
          }),
        ],
      }),
    ],
    [updateGrade, handleBatchPaste, showIsento, updateIsento]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const savingIndicator = isSaving
    ? { label: "A Guardar...", icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, tone: "text-amber-600 bg-amber-50 border-amber-200" }
    : { label: "Salvo no Servidor", icon: <CheckCircle2 className="w-3.5 h-3.5" />, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" }

  return (
    <div className="space-y-4">
      {/* BARRA DE ESTATÍSTICAS EM TEMPO REAL DA TURMA */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Média da Turma</span>
            <TrendingUp size={16} className="text-emerald-600" />
          </div>
          <p className="text-xl font-black text-slate-900 mt-1">
            {stats.mediaTurma !== null ? `${stats.mediaTurma} / 20` : "—"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Aprovados (≥10)</span>
            <CheckCircle size={16} className="text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-black text-emerald-700">{stats.aprovados}</span>
            <span className="text-xs font-bold text-slate-400">({stats.percAprovados}%)</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Em Risco (&lt;10)</span>
            <AlertCircle size={16} className="text-rose-500" />
          </div>
          <p className="text-xl font-black text-rose-600 mt-1">
            {stats.reprovados}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Lançamentos</span>
            <Users size={16} className="text-slate-400" />
          </div>
          <p className="text-xl font-black text-slate-900 mt-1">
            {stats.lancados} <span className="text-xs font-bold text-slate-400">/ {stats.total}</span>
          </p>
        </div>
      </div>

      {/* CONTAINER DA GRELHA PRINCIPAL */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* HEADER DA GRELHA */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{title}</h3>
            {subtitle ? <p className="text-xs font-medium text-slate-500">{subtitle}</p> : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPasteModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <Clipboard size={14} className="text-emerald-600" />
              <span>Colar Coluna do Excel</span>
            </button>

            <div className={`text-xs inline-flex items-center gap-1.5 px-3 py-1 rounded-full border font-bold ${savingIndicator.tone}`}>
              {savingIndicator.icon}
              <span>{savingIndicator.label}</span>
            </div>
          </div>
        </div>

        {/* MODAL DE COLAR DO EXCEL */}
        {showPasteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Clipboard className="text-emerald-600" size={20} />
                  <h3 className="text-base font-black text-slate-900">Colar Coluna do Excel / Sheets</h3>
                </div>
                <button
                  onClick={() => setShowPasteModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 mb-1">Selecione o Componente</label>
                  <select
                    value={pasteColumn}
                    onChange={(e) => setPasteColumn(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    <option value="mac1">MAC (Média de Avaliação Contínua)</option>
                    <option value="npp1">NPP (Nota da Prova do Professor)</option>
                    <option value="npt1">NPT (Nota da Prova Trimestral)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 mb-1">Cole aqui os valores (1 por linha)</label>
                  <textarea
                    rows={6}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Cole as notas copiadas do Excel (ex: 14.5, 12, 16.0)..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs font-mono text-slate-900 outline-none focus:border-emerald-600"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Valores como "145" serão corrigidos automaticamente para 14.5 (Escala 0 a 20).
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasteModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleApplyPasteModal}
                  disabled={!pasteText.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                >
                  Preencher Grelha
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VISÃO MOBILE DE CARDS */}
        <div className="block md:hidden">
          <div className="divide-y divide-slate-100">
            {table.getRowModel().rows.map((row) => {
              const isHighlighted = highlightId && row.original.id === highlightId
              return (
                <div
                  key={row.id}
                  className={`p-4 ${isHighlighted ? "bg-emerald-50/60" : "bg-white"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400 text-xs font-bold">Nº {row.original.numero}</span>
                      <p className="text-sm font-bold text-slate-900">{row.original.nome}</p>
                    </div>
                    <SyncIndicator
                      status={row.original._status === "pending" ? "syncing" : row.original._status}
                      compact
                    />
                  </div>

                  {showIsento && (
                    <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <input
                        type="checkbox"
                        checked={!!row.original.is_isento}
                        onChange={(e) => updateIsento(row.index, e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      Isento neste trimestre
                    </label>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {[
                      { label: "MAC", key: "mac1" as const, value: row.original.mac1 },
                      { label: "NPP", key: "npp1" as const, value: row.original.npp1 },
                      { label: "NPT", key: "npt1" as const, value: row.original.npt1 },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-slate-200/80 bg-slate-50 p-2.5">
                        <p className="text-[10px] font-black uppercase text-slate-400">{item.label}</p>
                        <div className="mt-1.5">
                          <GradeInput
                            inputRef={() => null}
                            disabled={!!row.original.is_isento}
                            value={item.value}
                            onChange={(val) => updateGrade(row.index, item.key, val)}
                            onBatchPaste={(pText) => handleBatchPaste(row.index, item.key, pText)}
                            onNavigate={() => null}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-center">
                      <p className="text-[10px] font-black uppercase text-slate-400">MT1</p>
                      <div className="mt-1.5 text-base font-black text-slate-900">
                        {row.original.mt1 ?? "—"}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* TABELA DESKTOP COM NAVEGAÇÃO E CORES VIVAS */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/80 text-slate-600 font-black uppercase text-[11px] tracking-wider border-b border-slate-200">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      className="px-3 py-3 border-r border-slate-200/70 last:border-r-0 text-center"
                      style={{ width: header.getSize() }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    highlightId && row.original.id === highlightId ? "bg-emerald-50/60" : ""
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 border-r border-slate-100 last:border-r-0 text-center">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const GradeInput = ({
  value,
  onChange,
  onBatchPaste,
  inputRef,
  onNavigate,
  disabled = false,
}: {
  value: number | null
  onChange: (v: string) => void
  onBatchPaste?: (pasteText: string) => void
  inputRef: (el: HTMLInputElement | null) => void
  onNavigate: (deltaRow: number, deltaCol: number) => void
  disabled?: boolean
}) => {
  const [draft, setDraft] = useState(value === null ? "" : String(value))
  const isFocusedRef = useRef(false)

  useEffect(() => {
    if (isFocusedRef.current) return
    if (value === null && draft !== "") return
    setDraft(value === null ? "" : String(value))
  }, [value, draft])

  const commitValue = (rawValue?: string) => {
    onChange(rawValue ?? draft)
  }

  // Estilização por faixa de nota pedagógica (0 a 20)
  let gradeStyle = "bg-slate-50 text-slate-700 border-slate-200"
  if (disabled) {
    gradeStyle = "bg-slate-100 text-slate-400 border-dashed text-[10px]"
  } else if (value !== null) {
    if (value >= 14) gradeStyle = "bg-emerald-50 text-emerald-800 border-emerald-300 font-black"
    else if (value >= 10) gradeStyle = "bg-amber-50 text-amber-800 border-amber-300 font-extrabold"
    else if (value >= 8) gradeStyle = "bg-orange-50 text-orange-800 border-orange-300 font-extrabold"
    else gradeStyle = "bg-rose-50 text-rose-700 border-rose-300 font-extrabold"
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={disabled ? "ISENTO" : draft}
      disabled={disabled}
      onFocus={() => {
        isFocusedRef.current = true
      }}
      onBlur={(e) => {
        isFocusedRef.current = false
        if (disabled) return
        const raw = e.currentTarget.value
        setDraft(raw)
        commitValue(raw)
      }}
      onChange={(e) => {
        if (disabled) return
        setDraft(e.target.value)
      }}
      onPaste={(e) => {
        if (disabled || !onBatchPaste) return
        const pasteData = e.clipboardData.getData("text")
        if (pasteData && (pasteData.includes("\n") || pasteData.includes("\t"))) {
          e.preventDefault()
          onBatchPaste(pasteData)
        }
      }}
      onKeyDown={(e) => {
        if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Enter"].includes(e.key)) {
          e.preventDefault()
        }
        if (e.key === "ArrowDown" || e.key === "Enter") {
          if (!disabled) commitValue((e.currentTarget as HTMLInputElement).value)
          onNavigate(1, 0)
        }
        if (e.key === "ArrowUp") {
          if (!disabled) commitValue((e.currentTarget as HTMLInputElement).value)
          onNavigate(-1, 0)
        }
        if (e.key === "ArrowLeft") {
          if (!disabled) commitValue((e.currentTarget as HTMLInputElement).value)
          onNavigate(0, -1)
        }
        if (e.key === "ArrowRight") {
          if (!disabled) commitValue((e.currentTarget as HTMLInputElement).value)
          onNavigate(0, 1)
        }
      }}
      className={`w-full h-11 md:h-8 text-center rounded-xl border text-xs font-extrabold outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all shadow-2xs ${gradeStyle}`}
      placeholder={disabled ? "" : "-"}
    />
  )
}
