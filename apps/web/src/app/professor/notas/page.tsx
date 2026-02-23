"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { enqueueOfflineAction } from "@/lib/offline/queue"
import { createIdempotencyKey } from "@/lib/idempotency"
import { useOfflineStatus } from "@/hooks/useOfflineStatus"
import { useOfficialDocs, type MiniPautaPayload } from "@/hooks/useOfficialDocs"
import { GradeEntryGrid, type StudentGradeRow } from "@/components/professor/GradeEntryGrid"

type Atrib = {
  id: string
  turma_disciplina_id?: string | null
  curso_matriz_id?: string | null
  turma: { id: string; nome: string | null; status_fecho?: string | null }
  disciplina: { id: string | null; nome: string | null }
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

export default function ProfessorNotasPage() {
  const searchParams = useSearchParams()
  const highlightAlunoId = searchParams?.get("alunoId") ?? null
  const [atribs, setAtribs] = useState<Atrib[]>([])
  const [turmaId, setTurmaId] = useState("")
  const [disciplinaId, setDisciplinaId] = useState("")
  const [turmaDisciplinaId, setTurmaDisciplinaId] = useState<string | null>(null)
  const [disciplinaNome, setDisciplinaNome] = useState<string | null>(null)
  const [pauta, setPauta] = useState<StudentGradeRow[]>([])
  const [loading, setLoading] = useState(false)
  const [periodosAtivos, setPeriodosAtivos] = useState<Array<1 | 2 | 3>>([])
  const [turmaStatusFecho, setTurmaStatusFecho] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [trimestreSelecionado, setTrimestreSelecionado] = useState<1 | 2 | 3>(1)

  const { online } = useOfflineStatus()
  const { gerarMiniPauta } = useOfficialDocs()

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
    if (!turmaId) {
      setTurmaStatusFecho(null)
      return
    }

    const item = atribs.find((a) => a.turma.id === turmaId)
    setTurmaStatusFecho(item?.turma?.status_fecho ?? null)
  }, [atribs, turmaId])

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
          turmaId,
          disciplinaId,
          detalhado: "1",
          trimestre: String(trimestreSelecionado),
        })
        if (turmaDisciplinaId) {
          params.set("turmaDisciplinaId", turmaDisciplinaId)
        }
        const res = await fetch(`/api/professor/pauta?${params.toString()}`, { cache: "no-store" })
        const json = await res.json().catch(() => null)
        if (!active) return
        if (res.ok && Array.isArray(json)) {
          setPauta(
            (json as PautaDetalhadaRow[]).map((row, index) => ({
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
  }, [turmaId, disciplinaId, trimestreSelecionado])

  useEffect(() => {
    if (!turmaId) {
      setPeriodosAtivos([])
      return
    }

    let active = true
    const load = async () => {
      const res = await fetch(`/api/professor/periodos?turma_id=${turmaId}`, { cache: "no-store" })
      const json = await res.json().catch(() => null)
      if (!active) return
      if (res.ok && json?.ok && Array.isArray(json.items)) {
        const numeros = json.items
          .map((item: { numero?: number }) => item?.numero)
          .filter((n: number | undefined) => n === 1 || n === 2 || n === 3)
        setPeriodosAtivos(numeros)
        if (numeros.length > 0 && !numeros.includes(trimestreSelecionado)) {
          setTrimestreSelecionado(numeros[0])
        }
      } else {
        setPeriodosAtivos([])
      }
    }

    load()
    return () => {
      active = false
    }
  }, [turmaId])

  const handleSaveBatch = async (rows: StudentGradeRow[]) => {
    if (!turmaId || !disciplinaId) return
    if (turmaStatusFecho && turmaStatusFecho !== "ABERTO") {
      throw new Error("Turma fechada para lançamento de notas")
    }
    const trimestre = trimestreSelecionado
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

      const idempotencyKey = createIdempotencyKey(
        `nota-${turmaId}-${disciplinaId}-${trimestre}-${tipo}-${Date.now()}`
      )
      const body = {
        turma_id: turmaId,
        disciplina_id: disciplinaId,
        turma_disciplina_id: turmaDisciplinaId || undefined,
        trimestre,
        tipo_avaliacao: tipo,
        disciplina_nome: disciplinaNome || undefined,
        notas,
      }

      const request = {
        url: "/api/professor/notas",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(body),
        type: "professor_notas",
      }

      if (!online) {
        await enqueueOfflineAction(request)
        continue
      }

      const res = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
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

  const handleExportMiniPauta = async () => {
    if (!turmaId || !disciplinaId || pauta.length === 0) return
    const turmaNome = atribs.find((a) => a.turma.id === turmaId)?.turma.nome || turmaId
    const disciplinaNomeResolved =
      disciplinaNome || atribs.find((a) => a.disciplina.id === disciplinaId)?.disciplina.nome || disciplinaId
    const hash = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`
    const emissao = new Date().toLocaleString("pt-PT")

    const alunos: MiniPautaPayload["alunos"] = pauta.map((row, index) => {
      const t = row.mt1 ?? null
      const mfd = t !== null ? Number(t) : null
      const trim1 = {
        mac: trimestreSelecionado === 1 ? row.mac1 ?? null : null,
        npp: trimestreSelecionado === 1 ? row.npp1 ?? null : null,
        npt: trimestreSelecionado === 1 ? row.npt1 ?? null : null,
        mt: trimestreSelecionado === 1 ? t : null,
      }
      const trim2 = {
        mac: trimestreSelecionado === 2 ? row.mac1 ?? null : null,
        npp: trimestreSelecionado === 2 ? row.npp1 ?? null : null,
        npt: trimestreSelecionado === 2 ? row.npt1 ?? null : null,
        mt: trimestreSelecionado === 2 ? t : null,
      }
      const trim3 = {
        mac: trimestreSelecionado === 3 ? row.mac1 ?? null : null,
        npp: trimestreSelecionado === 3 ? row.npp1 ?? null : null,
        npt: trimestreSelecionado === 3 ? row.npt1 ?? null : null,
        mt: trimestreSelecionado === 3 ? t : null,
      }
      return {
        id: row.id,
        numero: index + 1,
        nome: row.nome,
        genero: "M",
        trim1,
        trim2,
        trim3,
        mfd: mfd === null ? null : Number(mfd.toFixed(1)),
        obs: "",
      }
    })

    const payload: MiniPautaPayload = {
      metadata: {
        provincia: "—",
        escola: "Escola",
        anoLectivo: "",
        turma: turmaNome,
        disciplina: disciplinaNomeResolved,
        professor: "",
        diretor: "",
        emissao,
        hash,
        trimestresAtivos: [trimestreSelecionado],
        mostrarTrimestresInativos: false,
      },
      alunos,
    }

    setExporting(true)
    try {
      await gerarMiniPauta(payload, `MiniPauta_${disciplinaNomeResolved}_${Date.now()}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  const data = useMemo(() => pauta, [pauta])
  const turmaFechada = turmaStatusFecho && turmaStatusFecho !== "ABERTO"

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-klasse-green">Lançamento de notas</h1>
          <p className="text-sm text-slate-500">
            Selecione turma, disciplina e trimestre. As notas são salvas automaticamente.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4 relative z-10 overflow-visible">
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 overflow-visible">
              <div className="text-sm font-semibold text-slate-900">Turma e disciplina</div>
              <select
                value={turmaId}
                onChange={(event) => {
                  setTurmaId(event.target.value)
                  setDisciplinaId("")
                  setTurmaDisciplinaId(null)
                  setDisciplinaNome(null)
                  setPauta([])
                }}
                className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                required
              >
                <option value="">Turma</option>
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
                className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                required
                disabled={!turmaId}
              >
                <option value="">Disciplina</option>
                {(atribsByTurma.get(turmaId) || [])
                  .filter((a) => a.disciplina.id)
                  .map((a) => (
                    <option key={a.disciplina.id} value={a.disciplina.id || ""}>
                      {a.disciplina.nome || a.disciplina.id}
                    </option>
                  ))}
              </select>
              <select
                value={trimestreSelecionado}
                onChange={(event) => setTrimestreSelecionado(Number(event.target.value) as 1 | 2 | 3)}
                className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                disabled={!turmaId || periodosAtivos.length === 0}
              >
                {periodosAtivos.length === 0 && <option value={trimestreSelecionado}>Sem períodos</option>}
                {periodosAtivos.map((periodo) => (
                  <option key={periodo} value={periodo}>
                    {`Trimestre ${periodo}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 text-sm text-slate-600">
              <div className="font-semibold text-slate-900">Ações</div>
              <button
                type="button"
                onClick={handleExportMiniPauta}
                disabled={!turmaId || !disciplinaId || pauta.length === 0 || exporting || turmaFechada}
                className="w-full rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                {exporting ? "Gerando PDF..." : "Exportar mini‑pauta"}
              </button>
            </div>
          </aside>

          <section>
            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Carregando pauta...</div>
            ) : data.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                Selecione a turma e disciplina para carregar os alunos.
              </div>
            ) : turmaFechada ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                Lançamento de notas bloqueado: turma fechada.
              </div>
            ) : (
              <GradeEntryGrid
                initialData={data}
                subtitle={`${disciplinaNome ?? "Disciplina"} • Trimestre ${trimestreSelecionado}`}
                onSave={handleSaveBatch}
                highlightId={highlightAlunoId}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
