"use client"

import { useEffect, useMemo, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { enqueueOfflineAction } from "@/lib/offline/queue"
import { createIdempotencyKey } from "@/lib/idempotency"
import { useOfflineStatus } from "@/hooks/useOfflineStatus"
import { useOfficialDocs, type MiniPautaPayload } from "@/hooks/useOfficialDocs"
import { GradeEntryGrid, type StudentGradeRow } from "@/components/professor/GradeEntryGrid"
import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { formatTurmaDisplayName } from "@/utils/formatters"
import { useToast } from "@/components/feedback/FeedbackSystem"

type Atrib = {
  id: string
  turma_disciplina_id?: string | null
  curso_matriz_id?: string | null
  turma: { id: string; nome: string | null; status_fecho?: string | null }
  disciplina: { id: string | null; nome: string | null }
}

type PautaDetalhadaRow = {
  matricula_id: string
  aluno_id: string
  nome: string
  foto?: string | null
  numero_chamada?: number | null
  mac?: number | null
  npp?: number | null
  npt?: number | null
  mt?: number | null
}

type ExamComponent = {
  id: string
  codigo: "escrita" | "oral" | "pratica"
  peso: number
  nota_maxima: number
}

type ExamSession = {
  id: string
  tipo: "exame_nacional" | "recurso" | "extraordinario"
  modalidade: "simples" | "escrita_oral" | "oral_pratica"
  estado: "planeada" | "aberta" | "publicada" | "encerrada" | "cancelada"
  data_inicio: string
  data_fim: string
  exame_componentes?: ExamComponent[]
}

type RaaEligibilityView = {
  status: "aprovado" | "recurso" | "reprovado" | "reprovado_por_faltas" | "reprovado_por_indisciplina" | "pendente_dados" | "pendente_formula"
  motivo: string
  elegivelRecurso: boolean
  elegivelInscricaoCondicional: boolean
}

type RaaEligibilityResponse = {
  eligibility: RaaEligibilityView
  facts: { quantidade_negativas: number; percentual_presenca: number | null; dados_completos: boolean }
  next_action: string
  canonical_result?: {
    status: "aprovado" | "reprovado" | "reprovado_por_indisciplina" | "pendente_dados" | "pendente_formula"
    positivo: boolean | null
    cor: "azul" | "vermelho" | null
    nota: number | null
    corte: number | null
    escala: string | null
    motivo: string
    regime?: { codigo_regime?: string; formula_mfd?: Record<string, unknown>; eh_classe_exame?: boolean }
  } | null
}

type RaaRiskItem = {
  matricula_id: string
  aluno_id: string
  aluno_nome: string
  status: string | null
  nota: number | null
  corte: number | null
  risco: { codigo: string; label: string; action: string } | null
}

type ReapreciacaoItem = {
  id: string
  protocolo_publico: string
  estado: "pendente" | "em_analise" | "deferido" | "indeferido" | "expirado" | "cancelado"
  motivo: string
  prazo_em: string
  created_at: string
}

type ReopenRequest = {
  id: string
  status: "PENDENTE" | "APROVADO" | "REJEITADO" | "EXPIRADO"
  motivo: string
  decisao_motivo?: string | null
  expira_em?: string | null
  created_at: string
  decidido_em?: string | null
}

function friendlyGradeError(cause: unknown) {
  const raw = cause instanceof Error ? cause.message : String(cause)
  if (/ACADEMIC_YEAR_CLOSED|ano letivo.*(não permite|fechad)|ano letivo.*encerrad/i.test(raw)) return "Este ano letivo está fechado para lançamentos. Selecione o ano letivo ativo ou peça orientação à secretaria."
  if (/CROSS_YEAR_ENTITY_MISMATCH|não pertence ao ano letivo|ano letivo.*(incorreto|inválido)/i.test(raw)) return "A turma selecionada pertence a outro ano letivo. Volte aos filtros e selecione o ano letivo correspondente."
  if (/fechad|trav|reabert|bloquead/i.test(raw)) return "Este trimestre está fechado para lançamentos. Solicite uma reabertura à escola para continuar."
  if (/timeout|network|failed to fetch|ligação|conexão/i.test(raw)) return "Não foi possível comunicar com a escola. Verifique a ligação e tente novamente."
  return raw || "Verifique os dados e tente novamente."
}

export default function ProfessorNotasPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">A carregar pauta...</p>
        </div>
      </div>
    }>
      <ProfessorNotasContent />
    </Suspense>
  )
}

function ProfessorNotasContent() {
  const searchParams = useSearchParams()
  const requestedAnoLetivoId = searchParams?.get("ano_letivo_id") ?? ""
  const [anoLetivoId, setAnoLetivoId] = useState(requestedAnoLetivoId)
  const highlightAlunoId = searchParams?.get("alunoId") ?? null
  const [atribs, setAtribs] = useState<Atrib[]>([])
  const [loadingAtribs, setLoadingAtribs] = useState(true)
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
  const [savingNow, setSavingNow] = useState(false)
  const [reopenRequest, setReopenRequest] = useState<ReopenRequest | null>(null)
  const [reopenHistory, setReopenHistory] = useState<ReopenRequest[]>([])
  const [requestReason, setRequestReason] = useState("")
  const [requestingReopen, setRequestingReopen] = useState(false)
  const [matriculaIds, setMatriculaIds] = useState<Record<string, string>>({})
  const [examSessions, setExamSessions] = useState<ExamSession[]>([])
  const [selectedExamSessionId, setSelectedExamSessionId] = useState("")
  const [selectedExamComponentId, setSelectedExamComponentId] = useState("")
  const [examNotes, setExamNotes] = useState<Record<string, string>>({})
  const [loadingExamSessions, setLoadingExamSessions] = useState(false)
  const [savingExam, setSavingExam] = useState(false)
  const [raaStudentId, setRaaStudentId] = useState("")
  const [raaResult, setRaaResult] = useState<RaaEligibilityResponse | null>(null)
  const [loadingRaa, setLoadingRaa] = useState(false)
  const [raaRisks, setRaaRisks] = useState<RaaRiskItem[]>([])
  const [loadingRaaRisks, setLoadingRaaRisks] = useState(false)
  const [reapreciacaoItem, setReapreciacaoItem] = useState<ReapreciacaoItem | null>(null)
  const [reapreciacaoMotivo, setReapreciacaoMotivo] = useState("")
  const [submittingReapreciacao, setSubmittingReapreciacao] = useState(false)

  const { online } = useOfflineStatus()
  const { success, error: toastError, warning } = useToast()
  const { gerarMiniPauta } = useOfficialDocs()

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoadingAtribs(true)
      try {
        const res = await fetch("/api/professor/atribuicoes", { cache: "no-store" })
        const json = await res.json().catch(() => null)
        if (!active) return
        if (res.ok && json?.ok) {
          setAtribs(json.items || [])
          if (!requestedAnoLetivoId && json.context?.anoLetivoId) setAnoLetivoId(String(json.context.anoLetivoId))
        }
      } finally {
        if (active) setLoadingAtribs(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [requestedAnoLetivoId])

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
    if (!turmaId || !disciplinaId || !anoLetivoId) {
      setReopenRequest(null)
      setReopenHistory([])
      return
    }
    let active = true
    const loadReopenRequests = async () => {
      const params = new URLSearchParams({ turma_id: turmaId, disciplina_id: disciplinaId, trimestre: String(trimestreSelecionado), ano_letivo_id: anoLetivoId })
      const response = await fetch(`/api/professor/notas/reabertura?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => null)
      if (active && payload?.ok) {
        setReopenRequest(payload.current ?? null)
        setReopenHistory(Array.isArray(payload.items) ? payload.items : [])
      }
    }
    void loadReopenRequests()
    const timer = window.setInterval(() => void loadReopenRequests(), 30_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [turmaId, disciplinaId, turmaDisciplinaId, trimestreSelecionado, anoLetivoId])

  const handleRequestReopen = async () => {
    if (!turmaId || !disciplinaId || !anoLetivoId || requestReason.trim().length < 5) {
      warning("Explique o motivo da reabertura (mínimo de 5 caracteres).")
      return
    }
    setRequestingReopen(true)
    try {
      const response = await fetch("/api/professor/notas/reabertura", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ turma_id: turmaId, disciplina_id: disciplinaId, trimestre: trimestreSelecionado, ano_letivo_id: anoLetivoId, motivo: requestReason.trim() }) })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível enviar a solicitação.")
      setReopenRequest(payload.item)
      setRequestReason("")
      success("Solicitação enviada para análise da escola.")
    } catch (cause) {
      toastError("Não foi possível solicitar", cause instanceof Error ? cause.message : "Tente novamente.")
    } finally { setRequestingReopen(false) }
  }

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
          ...(anoLetivoId ? { ano_letivo_id: anoLetivoId } : {}),
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
          const detailedRows = json as PautaDetalhadaRow[]
          const nextMatriculaIds = detailedRows.reduce<Record<string, string>>((acc, row) => {
            acc[row.aluno_id] = row.matricula_id
            return acc
          }, {})
          setPauta(
            detailedRows.map((row, index) => ({
              id: row.aluno_id,
              numero: row.numero_chamada ?? index + 1,
              nome: row.nome,
              foto: row.foto ?? null,
              mac1: row.mac ?? null,
              npt1: row.npt ?? null,
              mt1: row.mt ?? null,
              _status: "synced",
            }))
          )
          setMatriculaIds(nextMatriculaIds)
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
  }, [turmaId, disciplinaId, turmaDisciplinaId, trimestreSelecionado, anoLetivoId])

  useEffect(() => {
    setExamSessions([])
    setSelectedExamSessionId("")
    setSelectedExamComponentId("")
    setExamNotes({})
    if (!turmaId || !anoLetivoId) return
    let active = true
    const load = async () => {
      setLoadingExamSessions(true)
      try {
        const params = new URLSearchParams({ ano_letivo_id: anoLetivoId, turma_id: turmaId })
        const response = await fetch(`/api/academico/exames/sessoes?${params.toString()}`, { cache: "no-store" })
        const payload = await response.json().catch(() => null)
        if (!active) return
        if (response.ok && payload?.ok) {
          const items = Array.isArray(payload.items) ? payload.items as ExamSession[] : []
          setExamSessions(items)
          const firstOpen = items.find((item) => ["aberta", "publicada"].includes(item.estado)) ?? items[0]
          if (firstOpen) {
            setSelectedExamSessionId(firstOpen.id)
            const firstComponent = firstOpen.exame_componentes?.[0]
            if (firstComponent) setSelectedExamComponentId(firstComponent.id)
          }
        }
      } finally {
        if (active) setLoadingExamSessions(false)
      }
    }
    void load()
    return () => { active = false }
  }, [turmaId, anoLetivoId])

  const selectedExamSession = examSessions.find((item) => item.id === selectedExamSessionId) ?? null
  const selectedExamComponent = selectedExamSession?.exame_componentes?.find((item) => item.id === selectedExamComponentId) ?? null
  const examLocked = !selectedExamSession || ["encerrada", "cancelada"].includes(selectedExamSession.estado)

  const handleSaveExamResults = async () => {
    if (!selectedExamSession || !selectedExamComponent || !turmaDisciplinaId || !disciplinaId) return
    const entries = pauta
      .map((student) => ({ student, raw: examNotes[student.id]?.trim() ?? "" }))
      .filter(({ raw }) => raw !== "")
    if (entries.length === 0) {
      warning("Lance pelo menos uma nota antes de guardar.")
      return
    }
    setSavingExam(true)
    try {
      for (const { student, raw } of entries) {
        const note = Number(raw.replace(",", "."))
        if (!Number.isFinite(note) || note < 0 || note > selectedExamComponent.nota_maxima) {
          throw new Error(`A nota de ${student.nome} deve estar entre 0 e ${selectedExamComponent.nota_maxima}.`)
        }
        const matriculaId = matriculaIds[student.id]
        if (!matriculaId) throw new Error(`Matrícula de ${student.nome} não encontrada na pauta.`)
        const response = await fetch("/api/academico/exames/resultados", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exame_sessao_id: selectedExamSession.id,
            exame_componente_id: selectedExamComponent.id,
            matricula_id: matriculaId,
            aluno_id: student.id,
            turma_disciplina_id: turmaDisciplinaId,
            nota: note,
          }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível guardar o resultado.")
      }
      setExamNotes({})
      success("Resultados guardados", `${entries.length} lançamento(s) sincronizado(s) com a escola.`)
    } catch (cause) {
      toastError("Não foi possível guardar os resultados", cause instanceof Error ? cause.message : "Tente novamente.")
    } finally {
      setSavingExam(false)
    }
  }

  const handleLoadRaaEligibility = async (studentId = raaStudentId) => {
    const matriculaId = matriculaIds[studentId]
    if (!matriculaId) return
    setLoadingRaa(true)
    try {
      const params = new URLSearchParams({ matricula_id: matriculaId })
      if (anoLetivoId) params.set("ano_letivo_id", anoLetivoId)
      if (disciplinaId) params.set("disciplina_id", disciplinaId)
      const response = await fetch(`/api/academico/raa/elegibilidade?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível consultar a elegibilidade.")
      setRaaResult(payload as RaaEligibilityResponse)
      const existingResponse = await fetch(`/api/academico/raa/reapreciacao?matricula_id=${encodeURIComponent(matriculaId)}&disciplina_id=${encodeURIComponent(disciplinaId)}`, { cache: "no-store" })
      const existingPayload = await existingResponse.json().catch(() => null)
      if (existingResponse.ok && existingPayload?.ok) setReapreciacaoItem(existingPayload.items?.[0] ?? null)
    } catch (cause) {
      toastError("Não foi possível consultar o RAA", cause instanceof Error ? cause.message : "Tente novamente.")
      setRaaResult(null)
    } finally {
      setLoadingRaa(false)
    }
  }

  const handleRequestReapreciacao = async () => {
    const matriculaId = matriculaIds[raaStudentId]
    if (!matriculaId || !disciplinaId || reapreciacaoMotivo.trim().length < 10) {
      warning("Explique o motivo da reapreciação com pelo menos 10 caracteres.")
      return
    }
    setSubmittingReapreciacao(true)
    try {
      const response = await fetch("/api/academico/raa/reapreciacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matricula_id: matriculaId,
          disciplina_id: disciplinaId,
          motivo: reapreciacaoMotivo.trim(),
          idempotency_key: `raa-reapreciacao-${matriculaId}-${disciplinaId}`,
          ano_letivo_id: anoLetivoId || undefined,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível enviar a reapreciação.")
      setReapreciacaoItem(payload.item)
      setReapreciacaoMotivo("")
      success(payload.duplicate ? "Pedido já registado" : "Reapreciação registada", `Protocolo ${payload.item?.protocolo_publico ?? "gerado"}.`)
    } catch (cause) {
      toastError("Não foi possível pedir reapreciação", cause instanceof Error ? cause.message : "Tente novamente.")
    } finally {
      setSubmittingReapreciacao(false)
    }
  }

  useEffect(() => {
    if (!turmaId || !disciplinaId || !anoLetivoId) {
      setRaaRisks([])
      return
    }
    let active = true
    const load = async () => {
      setLoadingRaaRisks(true)
      try {
        const params = new URLSearchParams({ turma_id: turmaId, disciplina_id: disciplinaId, ano_letivo_id: anoLetivoId })
        const response = await fetch(`/api/academico/raa/riscos?${params.toString()}`, { cache: "no-store" })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível carregar os riscos RAA.")
        if (active) setRaaRisks(Array.isArray(payload.items) ? payload.items as RaaRiskItem[] : [])
      } catch (cause) {
        if (active) {
          setRaaRisks([])
          toastError("Não foi possível carregar o painel RAA", cause instanceof Error ? cause.message : "Tente novamente.")
        }
      } finally {
        if (active) setLoadingRaaRisks(false)
      }
    }
    void load()
    return () => { active = false }
  }, [turmaId, disciplinaId, anoLetivoId, toastError])

  useEffect(() => {
    if (!turmaId) {
      setPeriodosAtivos([])
      return
    }

    let active = true
    const load = async () => {
      const periodosParams = new URLSearchParams({ turma_id: turmaId })
      if (anoLetivoId) periodosParams.set("ano_letivo_id", anoLetivoId)
      const res = await fetch(`/api/professor/periodos?${periodosParams.toString()}`, { cache: "no-store" })
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
  }, [turmaId, anoLetivoId, trimestreSelecionado])

  const handleSaveBatch = async (rows: StudentGradeRow[]) => {
    if (!turmaId || !disciplinaId) return
    if (!anoLetivoId) throw new Error("Ano letivo ativo não identificado. Atualize a página e tente novamente.")
    if (turmaStatusFecho && turmaStatusFecho !== "ABERTO") {
      throw new Error("Turma fechada para lançamento de notas")
    }
    const trimestre = trimestreSelecionado
    const payloads = [
      { tipo: "MAC", campo: "mac1" as const },
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
        ano_letivo_id: anoLetivoId,
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

  const handleSaveNow = async () => {
    if (!turmaId || !disciplinaId || pauta.length === 0 || !anoLetivoId) return
    if (notasBloqueadas) return
    setSavingNow(true)
    try {
      await handleSaveBatch(pauta)
      if (online) {
        success("Notas guardadas", "Os lançamentos foram sincronizados com o servidor.")
      } else {
        warning("Notas guardadas localmente", "Serão sincronizadas assim que a ligação voltar.")
      }
    } catch (cause) {
      toastError("Não foi possível guardar", friendlyGradeError(cause))
    } finally {
      setSavingNow(false)
    }
  }

  const handleExportMiniPauta = async () => {
    if (!turmaId || !disciplinaId || pauta.length === 0 || !anoLetivoId) return
    const turma = atribs.find((a) => a.turma.id === turmaId)?.turma
    const turmaNome = turma ? formatTurmaDisplayName(turma) : turmaId
    const disciplinaNomeResolved =
      disciplinaNome || atribs.find((a) => a.disciplina.id === disciplinaId)?.disciplina.nome || disciplinaId
    const hash = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`
    const emissao = new Date().toLocaleString("pt-PT")

    const alunos: MiniPautaPayload["alunos"] = pauta.map((row, index) => {
      const t = row.mt1 ?? null
      const mfd = t !== null ? Number(t) : null
      const trim1 = {
        mac: trimestreSelecionado === 1 ? row.mac1 ?? null : null,
        npt: trimestreSelecionado === 1 ? row.npt1 ?? null : null,
        mt: trimestreSelecionado === 1 ? t : null,
      }
      const trim2 = {
        mac: trimestreSelecionado === 2 ? row.mac1 ?? null : null,
        npt: trimestreSelecionado === 2 ? row.npt1 ?? null : null,
        mt: trimestreSelecionado === 2 ? t : null,
      }
      const trim3 = {
        mac: trimestreSelecionado === 3 ? row.mac1 ?? null : null,
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
  const reaberturaAtiva = reopenRequest?.status === "APROVADO" && Boolean(reopenRequest.expira_em) && new Date(reopenRequest.expira_em as string).getTime() > Date.now()
  const notasBloqueadas = Boolean(turmaFechada && !reaberturaAtiva)

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-5 sm:p-6 space-y-4 sm:space-y-6">
        <div>
          <DashboardHeader
            title="Lançamento de Notas"
            description="Selecione turma, disciplina e trimestre. Revise e salve os lançamentos quando estiver pronto."
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Professor", href: "/professor" },
              { label: "Notas" },
            ]}
          />
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="hidden space-y-3 sm:space-y-4 relative z-10 overflow-visible md:block">
            {loadingAtribs ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-3 animate-pulse">
                <div className="h-4 w-32 rounded-md bg-slate-200" />
                <div className="h-9 w-full rounded-xl bg-slate-100" />
                <div className="h-9 w-full rounded-xl bg-slate-100" />
                <div className="h-9 w-full rounded-xl bg-slate-100" />
                <div className="h-10 w-full rounded-xl bg-klasse-gold/20" />
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-3 overflow-visible">
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
                        {(() => {
                          const turma = atribs.find((a) => a.turma.id === tid)?.turma
                          return turma ? formatTurmaDisplayName(turma) : tid
                        })()}
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
                <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-2 text-sm text-slate-600">
                  <div className="font-semibold text-slate-900">Ações</div>
                  <button
                    type="button"
                    onClick={handleExportMiniPauta}
                    disabled={!turmaId || !disciplinaId || pauta.length === 0 || exporting || notasBloqueadas}
                    className="w-full rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    {exporting ? "Gerando PDF..." : "Exportar mini‑pauta"}
                  </button>
                </div>
              </>
            )}
          </aside>

          <section>
            <div className="md:hidden sticky top-0 z-20 mb-3 sm:mb-4 rounded-xl border border-slate-200 bg-white/95 p-3 sm:p-4 shadow-sm backdrop-blur">
              {loadingAtribs ? (
                <div className="grid gap-3 sm:grid-cols-2 animate-pulse">
                  <div className="h-10 rounded-xl bg-slate-100" />
                  <div className="h-10 rounded-xl bg-slate-100" />
                  <div className="h-10 rounded-xl bg-slate-100" />
                  <div className="h-10 rounded-xl bg-slate-200" />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={turmaId}
                    onChange={(event) => {
                      setTurmaId(event.target.value)
                      setDisciplinaId("")
                      setTurmaDisciplinaId(null)
                      setDisciplinaNome(null)
                      setPauta([])
                    }}
                    className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                  >
                    <option value="">Turma</option>
                    {Array.from(new Set(atribs.map((a) => a.turma.id))).map((tid) => (
                      <option key={tid} value={tid}>
                        {(() => {
                          const turma = atribs.find((a) => a.turma.id === tid)?.turma
                          return turma ? formatTurmaDisplayName(turma) : tid
                        })()}
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
                    className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
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
                    className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
                    disabled={!turmaId || periodosAtivos.length === 0}
                  >
                    {periodosAtivos.length === 0 && <option value={trimestreSelecionado}>Sem períodos</option>}
                    {periodosAtivos.map((periodo) => (
                      <option key={periodo} value={periodo}>
                        {`Trimestre ${periodo}`}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleSaveNow}
                    disabled={!turmaId || !disciplinaId || pauta.length === 0 || !anoLetivoId || savingNow || notasBloqueadas}
                    className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    {savingNow ? "Salvando..." : "Salvar agora"}
                  </button>
                  {turmaId && disciplinaId && (
                    <div className={`rounded-lg px-3 py-2 text-xs ${notasBloqueadas ? "bg-klasse-gold-50 text-klasse-gold-800" : "bg-emerald-50 text-emerald-800"}`}>
                      <p className="font-bold">
                        {notasBloqueadas ? "Trimestre fechado para lançamentos" : reaberturaAtiva ? "Reabertura aprovada" : "Trimestre disponível"}
                      </p>
                      <p className="mt-0.5">
                        {notasBloqueadas ? "A escola precisa aprovar uma abertura temporária." : reaberturaAtiva && reopenRequest?.expira_em ? `Você pode lançar até ${new Date(reopenRequest.expira_em).toLocaleString("pt-BR")}.` : "Os lançamentos podem ser salvos."}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {!online && (
                <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  Offline: as notas serão sincronizadas quando a conexão voltar.
                </div>
              )}
            </div>
            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 animate-pulse space-y-2">
                <div className="h-4 w-40 rounded-md bg-slate-200" />
                <div className="h-3 w-full rounded-md bg-slate-200" />
                <div className="h-3 w-5/6 rounded-md bg-slate-200" />
              </div>
            ) : data.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                Selecione a turma e disciplina para carregar os alunos.
              </div>
            ) : notasBloqueadas ? (
              <div className="rounded-xl border border-klasse-gold-200 bg-klasse-gold-50 p-4 text-sm text-klasse-gold-700">
                <p className="font-bold">Lançamento de notas bloqueado: turma fechada.</p>
                {reopenRequest?.status === "PENDENTE" ? <p className="mt-1">Solicitação pendente de análise pela escola.</p> : <div className="mt-4 space-y-3"><p className="text-sm text-klasse-gold-800">{reopenRequest?.status === "REJEITADO" ? "A solicitação anterior foi rejeitada. Envie uma nova justificativa para continuar." : reopenRequest?.status === "EXPIRADO" ? "A solicitação anterior expirou. Envie uma nova justificativa." : "Solicite à escola a abertura temporária deste trimestre."}</p><textarea value={requestReason} onChange={(event) => setRequestReason(event.target.value)} rows={3} placeholder="Explique por que precisa lançar ou corrigir esta nota." className="w-full rounded-xl border border-klasse-gold-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-klasse-gold-300" /><button type="button" onClick={() => void handleRequestReopen()} disabled={requestingReopen || !anoLetivoId} className="rounded-xl bg-klasse-gold px-4 py-2 font-bold text-white disabled:opacity-60">{requestingReopen ? "Enviando..." : "Solicitar reabertura"}</button></div>}
                {reopenHistory.length > 0 && <details className="mt-4 rounded-xl border border-klasse-gold-200 bg-white/70 p-3"><summary className="cursor-pointer text-xs font-bold text-klasse-gold-800">Ver histórico de solicitações ({reopenHistory.length})</summary><div className="mt-3 space-y-2">{reopenHistory.map((item) => <div key={item.id} className="rounded-lg border border-slate-100 p-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><span className="font-bold text-slate-800">{item.status}</span><span className="text-slate-500">{new Date(item.created_at).toLocaleString("pt-PT")}</span></div><p className="mt-1 text-slate-600">{item.motivo}</p>{item.decisao_motivo && <p className="mt-1 text-slate-500">Decisão: {item.decisao_motivo}</p>}</div>)}</div></details>}
              </div>
            ) : (
              <div className="space-y-3">
                {reaberturaAtiva && reopenRequest?.expira_em && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><p className="font-bold">Reabertura aprovada.</p><p>Você pode lançar notas até {new Date(reopenRequest.expira_em).toLocaleString("pt-BR")}.</p></div>}
                {turmaId && disciplinaId && pauta.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div>
                      <p className="text-sm font-bold text-slate-900">Análise RAA do aluno</p>
                      <p className="mt-1 text-xs text-slate-500">Consulte a elegibilidade sem sair da turma ou da disciplina atual.</p>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="flex-1 text-xs font-semibold text-slate-600">Aluno<select value={raaStudentId} onChange={(event) => { setRaaStudentId(event.target.value); setRaaResult(null); setReapreciacaoItem(null); setReapreciacaoMotivo("") }} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900"><option value="">Selecione um aluno</option>{pauta.map((student) => <option key={student.id} value={student.id}>{student.nome}</option>)}</select></label>
                      <button type="button" onClick={() => void handleLoadRaaEligibility()} disabled={!raaStudentId || loadingRaa} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">{loadingRaa ? "A consultar..." : "Consultar elegibilidade"}</button>
                    </div>
                    {raaResult && (() => {
                      const result = raaResult.canonical_result
                      const formula = result?.regime?.formula_mfd
                      const formulaText = formula && typeof formula === "object" ? Object.values(formula).find((value) => typeof value === "string" && value.includes("*")) : null
                      const isPendingFormula = result?.status === "pendente_formula"
                      return <div className={`mt-3 rounded-xl border p-3 text-sm ${isPendingFormula ? "border-klasse-gold-200 bg-klasse-gold-50" : "border-slate-100 bg-slate-50"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-black uppercase text-slate-800">{(result?.status ?? raaResult.eligibility.status).replace(/_/g, " ")}</span>
                          <span className="text-xs text-slate-500">{raaResult.facts.quantidade_negativas} negativa(s) · {raaResult.facts.percentual_presenca == null ? "frequência pendente" : `${raaResult.facts.percentual_presenca}% presença`}</span>
                        </div>
                        {isPendingFormula ? <><p className="mt-2 font-semibold text-klasse-gold-900">A turma está em regime de exame. A nota da disciplina já foi encontrada, mas o resultado final ainda depende da MFD e do lançamento do exame.</p><p className="mt-1 text-xs text-klasse-gold-800">Próximo passo: confirmar a sessão e os componentes do exame; o KLASSE atualizará o resultado quando a fórmula estiver completa.</p></> : <p className="mt-2 text-xs text-slate-600">{raaResult.next_action}</p>}
                        {result?.regime?.codigo_regime && <p className="mt-2 text-[11px] font-semibold text-slate-500">Regime: {result.regime.codigo_regime}{formulaText ? ` · Fórmula: ${formulaText}` : ""}</p>}
                        {(result?.status === "reprovado" || raaResult.eligibility.status === "reprovado") && (
                          <div className="mt-3 rounded-lg border border-rose-200 bg-white p-3">
                            {reapreciacaoItem ? (
                              <div className="text-xs text-slate-700">
                                <p className="font-black text-slate-900">Reapreciação {reapreciacaoItem.estado.replace(/_/g, " ")}</p>
                                <p className="mt-1">Protocolo: <span className="font-mono font-bold">{reapreciacaoItem.protocolo_publico}</span></p>
                                <p className="mt-1">Prazo: {new Date(reapreciacaoItem.prazo_em).toLocaleString("pt-PT")}</p>
                              </div>
                            ) : (
                              <>
                                <p className="text-xs font-bold text-rose-800">Pode solicitar reapreciação deste resultado.</p>
                                <textarea value={reapreciacaoMotivo} onChange={(event) => setReapreciacaoMotivo(event.target.value)} rows={2} placeholder="Explique o motivo da reapreciação (mínimo 10 caracteres)." className="mt-2 w-full rounded-lg border border-rose-200 px-3 py-2 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-rose-200" />
                                <button type="button" onClick={() => void handleRequestReapreciacao()} disabled={submittingReapreciacao || reapreciacaoMotivo.trim().length < 10} className="mt-2 rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">{submittingReapreciacao ? "A registar…" : "Solicitar reapreciação"}</button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    })()}
                  </div>
                )}
                {turmaId && disciplinaId && (loadingRaaRisks || raaRisks.length > 0) && (
                  <div className="rounded-xl border border-klasse-gold-200 bg-klasse-gold-50 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Painel de risco RAA</p>
                        <p className="mt-1 text-xs text-slate-600">Alunos desta turma e disciplina que exigem atenção, sem sair do contexto atual.</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-klasse-gold-900">{loadingRaaRisks ? "A atualizar…" : `${raaRisks.length} pendência(s)`}</span>
                    </div>
                    {!loadingRaaRisks && <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {raaRisks.map((item) => (
                        <button key={item.matricula_id} type="button" onClick={() => { setRaaStudentId(item.aluno_id); setRaaResult(null); setReapreciacaoItem(null); setReapreciacaoMotivo(""); void handleLoadRaaEligibility(item.aluno_id) }} className="rounded-lg border border-klasse-gold-200 bg-white p-3 text-left transition hover:border-klasse-gold-400">
                          <div className="flex items-center justify-between gap-2"><span className="text-sm font-bold text-slate-900">{item.aluno_nome}</span><span className="text-[10px] font-black uppercase text-klasse-gold-800">{item.risco?.label}</span></div>
                          <p className="mt-1 text-xs text-slate-600">{item.risco?.action}</p>
                        </button>
                      ))}
                    </div>}
                  </div>
                )}
                {turmaId && disciplinaId && (loadingExamSessions || examSessions.length > 0) && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Exames e recurso</p>
                        <p className="mt-1 text-xs text-slate-500">Sessões configuradas para esta turma. O lançamento permanece no contexto da disciplina selecionada.</p>
                      </div>
                      {selectedExamSession && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${examLocked ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>{selectedExamSession.estado}</span>}
                    </div>
                    {loadingExamSessions ? (
                      <div className="mt-3 h-10 animate-pulse rounded-xl bg-slate-100" />
                    ) : (
                      <div className="mt-4 space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="text-xs font-semibold text-slate-600">
                            Sessão
                            <select
                              value={selectedExamSessionId}
                              onChange={(event) => {
                                const next = examSessions.find((item) => item.id === event.target.value)
                                setSelectedExamSessionId(event.target.value)
                                setSelectedExamComponentId(next?.exame_componentes?.[0]?.id ?? "")
                                setExamNotes({})
                              }}
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900"
                            >
                              {examSessions.map((session) => <option key={session.id} value={session.id}>{session.tipo.replace("_", " ")} · {session.data_inicio} a {session.data_fim}</option>)}
                            </select>
                          </label>
                          <label className="text-xs font-semibold text-slate-600">
                            Componente
                            <select
                              value={selectedExamComponentId}
                              onChange={(event) => setSelectedExamComponentId(event.target.value)}
                              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900"
                              disabled={examLocked}
                            >
                              {(selectedExamSession?.exame_componentes ?? []).map((component) => <option key={component.id} value={component.id}>{component.codigo} · máximo {component.nota_maxima}</option>)}
                            </select>
                          </label>
                        </div>
                        {examLocked ? (
                          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Esta sessão está {selectedExamSession?.estado}. Consulte a secretaria para corrigir a configuração.</p>
                        ) : !selectedExamComponent ? (
                          <p className="rounded-lg bg-klasse-gold-50 px-3 py-2 text-xs text-klasse-gold-800">A sessão ainda não tem componentes configurados.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-slate-100">
                            <table className="min-w-full text-left text-sm">
                              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Aluno</th><th className="w-32 px-3 py-2">Nota</th></tr></thead>
                              <tbody className="divide-y divide-slate-100">
                                {pauta.map((student) => <tr key={student.id}><td className="px-3 py-2 font-medium text-slate-800">{student.nome}</td><td className="px-3 py-2"><input type="number" min="0" max={selectedExamComponent.nota_maxima} step="0.01" value={examNotes[student.id] ?? ""} onChange={(event) => setExamNotes((current) => ({ ...current, [student.id]: event.target.value }))} className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-klasse-gold focus:ring-2 focus:ring-klasse-gold/20" aria-label={`Nota de exame de ${student.nome}`} /></td></tr>)}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {!examLocked && selectedExamComponent && <button type="button" onClick={() => void handleSaveExamResults()} disabled={savingExam || !turmaDisciplinaId} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">{savingExam ? "Guardando resultados..." : "Guardar resultados do exame"}</button>}
                      </div>
                    )}
                  </div>
                )}
                <GradeEntryGrid
                  initialData={data}
                  subtitle={`${disciplinaNome ?? "Disciplina"} • Trimestre ${trimestreSelecionado}`}
                  onSave={handleSaveBatch}
                  onSaveError={(cause) => toastError("Não foi possível guardar", friendlyGradeError(cause))}
                  highlightId={highlightAlunoId}
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
