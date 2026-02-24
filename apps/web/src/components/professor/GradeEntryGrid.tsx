"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { CheckCircle2, Loader2 } from "lucide-react"
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
  _status: "synced" | "pending" | "error"
}

type GradeEntryGridProps = {
  initialData: StudentGradeRow[]
  title?: string
  subtitle?: string
  debounceMs?: number
  onSave?: (rows: StudentGradeRow[]) => Promise<void> | void
  highlightId?: string | null
  onDataChange?: (rows: StudentGradeRow[]) => void
}

const INPUT_COLUMNS = ["mac1", "npp1", "npt1"] as const

const clampNota = (value: string) => {
  const normalized = value.replace(",", ".").trim()
  if (normalized === "") return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return Math.min(20, Math.max(0, parsed))
}

const calculateMT = (row: StudentGradeRow) => {
  const { mac1, npp1, npt1 } = row
  if (mac1 !== null && npp1 !== null && npt1 !== null) {
    return Number(((mac1 + npp1 + npt1) / 3).toFixed(1))
  }
  if (mac1 !== null && npp1 !== null) {
    return Number(((mac1 + npp1) / 2).toFixed(1))
  }
  return null
}

export function GradeEntryGrid({
  initialData,
  title = "Lançamento de Notas",
  subtitle,
  debounceMs = 800,
  onSave,
  highlightId,
  onDataChange,
}: GradeEntryGridProps) {
  const [data, setData] = useState<StudentGradeRow[]>(initialData)
  const [isSaving, setIsSaving] = useState(false)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const pendingIdsRef = useRef<Set<string>>(new Set())
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setData(initialData)
  }, [initialData])

  const onDataChangeRef = useRef(onDataChange)

  useEffect(() => {
    onDataChangeRef.current = onDataChange
  }, [onDataChange])

  useEffect(() => {
    onDataChangeRef.current?.(data)
  }, [data])

  const flushSave = useCallback(async () => {
    if (!onSave || pendingIdsRef.current.size === 0) return
    const ids = Array.from(pendingIdsRef.current)
    pendingIdsRef.current.clear()
    const payload = data.filter((row) => ids.includes(row.id))
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
    } catch {
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
    } finally {
      setIsSaving(false)
    }
  }, [data, onSave])

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
          updatedRow.mt1 = calculateMT(updatedRow)
          return updatedRow
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
          <span className="font-mono text-slate-400 text-xs">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("nome", {
        header: "Nome do Aluno",
        size: 250,
        cell: (info) => (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-200" />
            <span className="font-medium text-slate-700">{info.getValue()}</span>
          </div>
        ),
      }),
      columnHelper.accessor("_status", {
        header: "Status",
        size: 80,
        cell: (info) => {
          const status = info.getValue()
          const mapped = status === "pending" ? "syncing" : status === "error" ? "error" : "synced"
          return <SyncIndicator status={mapped} compact />
        },
      }),
      columnHelper.group({
        header: "Iº TRIMESTRE",
        columns: [
          columnHelper.accessor("mac1", {
            header: "MAC",
            size: 80,
            cell: ({ row, getValue }) => (
              <GradeInput
                inputRef={(el) => {
                  inputRefs.current[`${row.index}-0`] = el
                }}
                value={getValue()}
                onChange={(val) => updateGrade(row.index, "mac1", val)}
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
                value={getValue()}
                onChange={(val) => updateGrade(row.index, "npp1", val)}
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
                value={getValue()}
                onChange={(val) => updateGrade(row.index, "npt1", val)}
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
              if (val === null) return "-"
              return (
                <span className={`font-bold ${val < 10 ? "text-rose-600" : "text-emerald-600"}`}>
                  {val}
                </span>
              )
            },
          }),
        ],
      }),
    ],
    [updateGrade]
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const savingIndicator = isSaving
    ? { label: "Salvando...", icon: <Loader2 className="w-3 h-3 animate-spin" />, tone: "text-blue-600" }
    : { label: "Salvo", icon: <CheckCircle2 className="w-3 h-3" />, tone: "text-emerald-600" }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase">{title}</h3>
          {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <div className={`text-xs flex items-center gap-1 ${savingIndicator.tone}`}>
          {savingIndicator.icon}
          {savingIndicator.label}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-white text-slate-500 font-bold uppercase text-xs border-b border-slate-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    className="px-4 py-3 border-r border-slate-100 last:border-r-0 text-center"
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
                className={`hover:bg-slate-50 transition-colors ${
                  highlightId && row.original.id === highlightId ? "bg-emerald-50" : ""
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2 border-r border-slate-100 last:border-r-0 text-center">
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

const GradeInput = ({
  value,
  onChange,
  inputRef,
  onNavigate,
}: {
  value: number | null
  onChange: (v: string) => void
  inputRef: (el: HTMLInputElement | null) => void
  onNavigate: (deltaRow: number, deltaCol: number) => void
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

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={draft}
      onFocus={() => {
        isFocusedRef.current = true
      }}
      onBlur={(e) => {
        isFocusedRef.current = false
        const raw = e.currentTarget.value
        setDraft(raw)
        commitValue(raw)
      }}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Enter"].includes(e.key)) {
          e.preventDefault()
        }
        if (e.key === "ArrowDown" || e.key === "Enter") {
          commitValue((e.currentTarget as HTMLInputElement).value)
          onNavigate(1, 0)
        }
        if (e.key === "ArrowUp") {
          commitValue((e.currentTarget as HTMLInputElement).value)
          onNavigate(-1, 0)
        }
        if (e.key === "ArrowLeft") {
          commitValue((e.currentTarget as HTMLInputElement).value)
          onNavigate(0, -1)
        }
        if (e.key === "ArrowRight") {
          commitValue((e.currentTarget as HTMLInputElement).value)
          onNavigate(0, 1)
        }
      }}
      className={`w-full h-8 text-center rounded border border-slate-200 font-bold outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${
        value !== null && value < 10 ? "text-rose-600 bg-rose-50" : "text-slate-900"
      } ${value === null ? "bg-slate-50" : "bg-white"}`}
      placeholder="-"
    />
  )
}
