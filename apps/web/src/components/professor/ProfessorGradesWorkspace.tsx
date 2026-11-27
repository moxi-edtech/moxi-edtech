"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { usePortalDrawerGuard, usePortalDrawerNavigation } from "@/components/portal/ui/PortalDrawerNavigator"
import { enqueueOfflineAction } from "@/lib/offline/queue"
import { createIdempotencyKey } from "@/lib/idempotency"
import { currentGradePeriod, type GradePeriodRow } from "@/lib/academico/grade-period-context"
import { resolveGradeEntryAvailability } from "@/lib/academico/grade-entry-availability"
import { useOfflineStatus } from "@/hooks/useOfflineStatus"
import { useOfficialDocs, type MiniPautaPayload } from "@/hooks/useOfficialDocs"
import { GradeEntryGrid, type StudentGradeRow } from "@/components/professor/GradeEntryGrid"
import { PortalSheet } from "@/components/portal/ui/PortalSheet"
import { SlidersHorizontal } from "lucide-react"
import { DashboardHeader } from "@/components/layout/DashboardHeader"
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page"
import { formatTurmaDisplayName } from "@/utils/formatters"
import { useToast } from "@/components/feedback/FeedbackSystem"

type Atrib = {
  id: string
  turma_disciplina_id?: string | null
  curso_matriz_id?: string | null
  turma: { id: string; nome: string | null; status_fecho?: string | null }
  disciplina: { id: string | null; nome: string | null }
}

type GradeRevision = { id: string; updated_at: string | null; valor: number | null; is_isento: boolean | null }
type GradeComponent = 'MAC' | 'NPP' | 'NPT'
type GradeBaseline = { row: StudentGradeRow; matriculaId: string; versions: Record<GradeComponent, GradeRevision | null> | undefined }

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
  versions?: Record<GradeComponent, GradeRevision | null>
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

type RaaViewerScope = "professor_context" | "school_management"

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
  status: "PENDENTE" | "APROVADO" | "REJEITADO" | "EXPIRADO" | "REVOGADO"
  motivo: string
  decisao_motivo?: string | null
  expira_em?: string | null
  created_at: string
  decidido_em?: string | null
}

function parseGradeWeightsHeader(value: string | null): Record<string, number> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, raw]) => [key, Number(raw)] as const)
        .filter(([, weight]) => Number.isFinite(weight)),
    )
  } catch {
    return {}
  }
}

function friendlyGradeError(cause: unknown) {
  const raw = cause instanceof Error ? cause.message : String(cause)
  if (/GRADE_CONFLICT|GRADE_REVISION_REQUIRED/.test(raw)) return "Outra sessão alterou a pauta, ou a revisão está indisponível. Recarregue e confira as notas antes de guardar."
  if (/ACADEMIC_YEAR_CLOSED|ano letivo.*(não permite|fechad)|ano letivo.*encerrad/i.test(raw)) return "Este ano letivo está fechado para lançamentos. Selecione o ano letivo ativo ou peça orientação à secretaria."
  if (/CROSS_YEAR_ENTITY_MISMATCH|não pertence ao ano letivo|ano letivo.*(incorreto|inválido)/i.test(raw)) return "A turma selecionada pertence a outro ano letivo. Volte aos filtros e selecione o ano letivo correspondente."
  if (/fechad|trav|reabert|bloquead/i.test(raw)) return "Este trimestre está fechado para lançamentos. Solicite uma reabertura à escola para continuar."
  if (/timeout|network|failed to fetch|ligação|conexão/i.test(raw)) return "Não foi possível comunicar com a escola. Verifique a ligação e tente novamente."
  return raw || "Verifique os dados e tente novamente."
}

export function ProfessorGradesWorkspace({ embedded = false, requestedAnoLetivoId = "", requestedTurmaId = "", requestedDisciplinaId = "", requestedTerm = null, highlightAlunoId = null }: {
  embedded?: boolean; requestedAnoLetivoId?: string; requestedTurmaId?: string; requestedDisciplinaId?: string; requestedTerm?: string | null; highlightAlunoId?: string | null;
}) {
  const navigation = usePortalDrawerNavigation()
  const [anoLetivoId, setAnoLetivoId] = useState(requestedAnoLetivoId)
  const [atribs, setAtribs] = useState<Atrib[]>([])
  const [loadingAtribs, setLoadingAtribs] = useState(true)
  const [turmaId, setTurmaId] = useState("")
  const [disciplinaId, setDisciplinaId] = useState("")
  const [turmaDisciplinaId, setTurmaDisciplinaId] = useState<string | null>(null)
  const [disciplinaNome, setDisciplinaNome] = useState<string | null>(null)
  const saveControl = useRef<(() => Promise<void>) | null>(null)
  const [loadedRows, setLoadedRows] = useState<StudentGradeRow[]>([])
  const baselines = useRef(new Map<string, GradeBaseline>())
  const gradeConflictRef = useRef(false)
  const [gradeConflict, setGradeConflict] = useState(false)
  const [pautaReload, setPautaReload] = useState(0)
  const [pauta, setPauta] = useState<StudentGradeRow[]>([])
  const [gradeMaxima, setGradeMaxima] = useState<number | null>(20)
  const [gradeCorte, setGradeCorte] = useState<number | null>(10)
  const [gradeEscala, setGradeEscala] = useState<string | null>(null)
  const [gradeComponentes, setGradeComponentes] = useState<string[]>([])
  const [gradePesos, setGradePesos] = useState<Record<string, number>>({})
  const [academicMode, setAcademicMode] = useState<"CURRENT" | "HISTORICAL_READ">("CURRENT")
  const [loading, setLoading] = useState(false)
  const [periodosAtivos, setPeriodosAtivos] = useState<Array<1 | 2 | 3>>([])
  const [periodosDetalhes, setPeriodosDetalhes] = useState<GradePeriodRow[]>([])
  const [loadingPeriodos, setLoadingPeriodos] = useState(false)
  const [periodosError, setPeriodosError] = useState<string | null>(null)
  const [periodosRetry, setPeriodosRetry] = useState(0)
  const [turmaStatusFecho, setTurmaStatusFecho] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [showInactiveTerms, setShowInactiveTerms] = useState(false)
  const exportInFlight = useRef(false)
  const requestedTrimestre = Number(requestedTerm)
  const requestedTrimestreValid = requestedTrimestre === 1 || requestedTrimestre === 2 || requestedTrimestre === 3
  const [trimestreSelecionado, setTrimestreSelecionado] = useState<1 | 2 | 3>(requestedTrimestreValid ? requestedTrimestre as 1 | 2 | 3 : 1)
  const [savingNow, setSavingNow] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const [completingGrades, setCompletingGrades] = useState(false)
  const [gradeDraft, setGradeDraft] = useState<StudentGradeRow[]>([])
  const [completedScopes, setCompletedScopes] = useState<Record<string, boolean>>({})
  const [reopenRequest, setReopenRequest] = useState<ReopenRequest | null>(null)
  const [reopenHistory, setReopenHistory] = useState<ReopenRequest[]>([])
  const [requestReason, setRequestReason] = useState("")
  const [requestingReopen, setRequestingReopen] = useState(false)
  const [reopenSheet, setReopenSheet] = useState(false)
  const [matriculaIds, setMatriculaIds] = useState<Record<string, string>>({})
  const [examSessions, setExamSessions] = useState<ExamSession[]>([])
  const [selectedExamSessionId, setSelectedExamSessionId] = useState("")
  const [selectedExamComponentId, setSelectedExamComponentId] = useState("")
  const [examNotes, setExamNotes] = useState<Record<string, string>>({})
  const [loadingExamSessions, setLoadingExamSessions] = useState(false)
  const [savingExam, setSavingExam] = useState(false)
  const [raaStudentId, setRaaStudentId] = useState("")
  const [raaOpen, setRaaOpen] = useState(false)
  const raaInFlight = useRef(false)
  const raaScope = JSON.stringify([turmaId, disciplinaId, anoLetivoId, turmaDisciplinaId, trimestreSelecionado])
  const [loadedPautaScope, setLoadedPautaScope] = useState<string | null>(null)
  const pautaReady = loadedPautaScope === raaScope
  const raaScopeRef = useRef(raaScope)
  const [raaResult, setRaaResult] = useState<RaaEligibilityResponse | null>(null)
  const [loadingRaa, setLoadingRaa] = useState(false)
  const [raaRisks, setRaaRisks] = useState<RaaRiskItem[]>([])
  const [raaViewerScope, setRaaViewerScope] = useState<RaaViewerScope | null>(null)
  const [loadingRaaRisks, setLoadingRaaRisks] = useState(false)
  const [raaRisksLoaded, setRaaRisksLoaded] = useState(false)
  const [raaRisksError, setRaaRisksError] = useState<string | null>(null)
  const [raaRisksRetry, setRaaRisksRetry] = useState(0)
  const [reapreciacaoItem, setReapreciacaoItem] = useState<ReapreciacaoItem | null>(null)
  const [reapreciacaoMotivo, setReapreciacaoMotivo] = useState("")
  const [submittingReapreciacao, setSubmittingReapreciacao] = useState(false)

  useLayoutEffect(() => { raaScopeRef.current = raaScope; setRaaOpen(false); setRaaStudentId(""); setRaaResult(null); setReapreciacaoItem(null); setReapreciacaoMotivo(""); setExportOpen(false) }, [raaScope])
  const { online } = useOfflineStatus()
  const { success, error: toastError, warning } = useToast()
  const { gerarMiniPauta } = useOfficialDocs()

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoadingAtribs(true)
      try {
        const assignmentParams = new URLSearchParams(); if (requestedAnoLetivoId) assignmentParams.set("ano_letivo_id", requestedAnoLetivoId)
        const res = await fetch(`/api/professor/atribuicoes${assignmentParams.size ? "?" + assignmentParams.toString() : ""}`, { cache: "no-store" })
        const json = await res.json().catch(() => null)
        if (!active) return
        if (res.ok && json?.ok && (!requestedAnoLetivoId || json.context?.anoLetivoId === requestedAnoLetivoId)) {
          const scoped: Atrib[] = (json.items || []).filter((item: Atrib) => (!embedded || ((!requestedTurmaId || item.turma.id === requestedTurmaId) && (!requestedDisciplinaId || item.disciplina.id === requestedDisciplinaId))))
          setAtribs(scoped)
          const matches = scoped.filter(item => item.turma.id === requestedTurmaId && item.disciplina.id && (!requestedDisciplinaId || item.disciplina.id === requestedDisciplinaId))
          if (scoped.some(item => item.turma.id === requestedTurmaId)) setTurmaId(requestedTurmaId)
          if (matches.length === 1) { setDisciplinaId(matches[0].disciplina.id ?? ""); setTurmaDisciplinaId(matches[0].turma_disciplina_id ?? null); setDisciplinaNome(matches[0].disciplina.nome) }
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
  }, [requestedAnoLetivoId, requestedTurmaId, requestedDisciplinaId, embedded])

  const atribsByTurma = useMemo(() => {
    return atribs.reduce((acc, a) => {
      const list = acc.get(a.turma.id) || []
      if (!list.some((item) => item.disciplina.id === a.disciplina.id)) list.push(a)
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
  }, [turmaId, disciplinaId, turmaDisciplinaId, trimestreSelecionado, anoLetivoId, pautaReload])

  const handleRequestReopen = async () => {
    if (requestingReopen) return
    if (!turmaId || !disciplinaId || !anoLetivoId || requestReason.trim().length < 5) {
      warning("Explique o motivo da reabertura (mínimo de 5 caracteres).")
      return
    }
    setRequestingReopen(true)
    try {
      const response = await fetch("/api/professor/notas/reabertura", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ turma_id: turmaId, disciplina_id: disciplinaId, trimestre: trimestreSelecionado, ano_letivo_id: anoLetivoId, motivo: requestReason.trim() }) })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível enviar a solicitação.")
      navigation?.notifyChanged()
      setReopenRequest(payload.item)
      setRequestReason("")
      setReopenSheet(false)
      success("Solicitação enviada para análise da escola.")
    } catch (cause) {
      toastError("Não foi possível solicitar", cause instanceof Error ? cause.message : "Tente novamente.")
    } finally { setRequestingReopen(false) }
  }

  useEffect(() => {
    if (!turmaId || !disciplinaId) {
      setPauta([])
      setMatriculaIds({}); setLoadedPautaScope(null)
      return
    }

    let active = true
    const load = async () => {
      setLoading(true)
      setLoadedPautaScope(null)
      baselines.current.clear()
      gradeConflictRef.current = false
      setGradeConflict(false)
      setGradeDraft([])
      setMatriculaIds({})
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
        const maxRaw = res.headers.get("x-klasse-grade-max")
        const cutoffRaw = res.headers.get("x-klasse-grade-cutoff")
        const maxHeader = maxRaw === null || maxRaw === "" ? null : Number(maxRaw)
        const cutoffHeader = cutoffRaw === null || cutoffRaw === "" ? null : Number(cutoffRaw)
        const modeHeader = res.headers.get("x-klasse-academic-mode")
        const scaleHeader = res.headers.get("x-klasse-grade-scale")
        const componentsHeader = res.headers.get("x-klasse-grade-components")
        const weightsHeader = res.headers.get("x-klasse-grade-weights")
        const json = await res.json().catch(() => null)
        if (!active) return

        setGradeMaxima(typeof maxHeader === "number" && Number.isFinite(maxHeader) && maxHeader > 0 ? maxHeader : null)
        setGradeCorte(typeof cutoffHeader === "number" && Number.isFinite(cutoffHeader) && cutoffHeader > 0 ? cutoffHeader : null)
        setGradeEscala(scaleHeader)
        setAcademicMode(modeHeader === "HISTORICAL_READ" ? "HISTORICAL_READ" : "CURRENT")
        setGradeComponentes(
          componentsHeader
            ? componentsHeader.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean)
            : [],
        )
        setGradePesos(parseGradeWeightsHeader(weightsHeader))

        if (res.ok && Array.isArray(json)) {
          const detailedRows = json as PautaDetalhadaRow[]
          const nextMatriculaIds = detailedRows.reduce<Record<string, string>>((acc, row) => {
            acc[row.aluno_id] = row.matricula_id
            return acc
          }, {})
          const rows = detailedRows.map<StudentGradeRow>((row, index) => ({
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
          baselines.current = new Map(rows.map((row, index) => [row.id, { row, matriculaId: detailedRows[index].matricula_id, versions: detailedRows[index].versions }]))
          setLoadedRows(rows)
          setPauta(rows)
          setMatriculaIds(nextMatriculaIds)
          setLoadedPautaScope(raaScope)
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
      navigation?.notifyChanged()
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
    if (!pautaReady || !matriculaId || raaInFlight.current) return
    const scope = raaScope
    raaInFlight.current = true
    setLoadingRaa(true)
    try {
      const params = new URLSearchParams({ matricula_id: matriculaId })
      if (anoLetivoId) params.set("ano_letivo_id", anoLetivoId)
      if (disciplinaId) params.set("disciplina_id", disciplinaId)
      const response = await fetch(`/api/academico/raa/elegibilidade?${params.toString()}`, { cache: "no-store" })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível consultar a elegibilidade.")
      if (raaScopeRef.current !== scope) return
      setRaaResult(payload as RaaEligibilityResponse)
      const existingResponse = await fetch(`/api/academico/raa/reapreciacao?matricula_id=${encodeURIComponent(matriculaId)}&disciplina_id=${encodeURIComponent(disciplinaId)}`, { cache: "no-store" })
      const existingPayload = await existingResponse.json().catch(() => null)
      if (raaScopeRef.current === scope && existingResponse.ok && existingPayload?.ok) setReapreciacaoItem(existingPayload.items?.[0] ?? null)
    } catch (cause) {
      toastError("Não foi possível consultar o RAA", cause instanceof Error ? cause.message : "Tente novamente.")
      if (raaScopeRef.current === scope) setRaaResult(null)
    } finally {
      raaInFlight.current = false
      setLoadingRaa(false)
    }
  }

  const handleRequestReapreciacao = async () => {
    const matriculaId = matriculaIds[raaStudentId]
    if (!pautaReady || !matriculaId || !disciplinaId || !raaResult || loadingRaa || raaInFlight.current || reapreciacaoMotivo.trim().length < 10) {
      warning("Explique o motivo da reapreciação com pelo menos 10 caracteres.")
      return
    }
    const scope = raaScope
    raaInFlight.current = true
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
      if (raaScopeRef.current !== scope) return
      navigation?.notifyChanged()
      setReapreciacaoItem(payload.item)
      setReapreciacaoMotivo("")
      success(payload.duplicate ? "Pedido já registado" : "Reapreciação registada", `Protocolo ${payload.item?.protocolo_publico ?? "gerado"}.`)
    } catch (cause) {
      toastError("Não foi possível pedir reapreciação", cause instanceof Error ? cause.message : "Tente novamente.")
    } finally {
      raaInFlight.current = false
      setSubmittingReapreciacao(false)
    }
  }

  useEffect(() => {
    if (!turmaId || !disciplinaId || !anoLetivoId) {
      setRaaRisks([])
      setRaaViewerScope(null)
      setRaaRisksLoaded(false)
      setRaaRisksError(null)
      setLoadingRaaRisks(false)
      return
    }
    let active = true
    const load = async () => {
      setLoadingRaaRisks(true)
      setRaaRisksLoaded(false)
      setRaaRisksError(null)
      try {
        const params = new URLSearchParams({ turma_id: turmaId, disciplina_id: disciplinaId, ano_letivo_id: anoLetivoId })
        const response = await fetch(`/api/academico/raa/riscos?${params.toString()}`, { cache: "no-store" })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Não foi possível carregar os riscos RAA.")
        if (active) {
          setRaaViewerScope(payload.viewer_scope === "school_management" ? "school_management" : "professor_context")
          setRaaRisks(Array.isArray(payload.items) ? payload.items as RaaRiskItem[] : [])
        }
      } catch (cause) {
        if (active) {
          setRaaRisks([])
          setRaaViewerScope(null)
          setRaaRisksError(cause instanceof Error ? cause.message : "Não foi possível carregar os riscos RAA.")
        }
      } finally {
        if (active) {
          setLoadingRaaRisks(false)
          setRaaRisksLoaded(true)
        }
      }
    }
    void load()
    return () => { active = false }
  }, [turmaId, disciplinaId, anoLetivoId, raaRisksRetry])

  useEffect(() => {
    if (!turmaId) {
      setPeriodosAtivos([])
      setPeriodosDetalhes([])
      setPeriodosError(null)
      setLoadingPeriodos(false)
      return
    }

    let active = true
    const load = async () => {
      setLoadingPeriodos(true)
      setPeriodosError(null)
      try {
        const periodosParams = new URLSearchParams({ turma_id: turmaId })
        if (anoLetivoId) periodosParams.set("ano_letivo_id", anoLetivoId)
        const res = await fetch(`/api/professor/periodos?${periodosParams.toString()}`, { cache: "no-store" })
        const json = await res.json().catch(() => null)
        if (!active) return
        if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
          throw new Error(json?.message || json?.error || "Não foi possível carregar os trimestres.")
        }
        const numeros: Array<1 | 2 | 3> = Array.from(new Set<1 | 2 | 3>(json.items
          .map((item: { numero?: number | string | null }) => Number(item?.numero))
          .filter((n: number): n is 1 | 2 | 3 => n === 1 || n === 2 || n === 3)))
          .sort((a, b) => a - b)
        setPeriodosAtivos(numeros)
        const canonicalPeriods = json.items as GradePeriodRow[]
        setPeriodosDetalhes(canonicalPeriods)
        const current = currentGradePeriod(canonicalPeriods)
        const chosen = requestedTrimestreValid && numeros.includes(requestedTrimestre as 1 | 2 | 3)
          ? requestedTrimestre as 1 | 2 | 3
          : current && numeros.includes(current as 1 | 2 | 3)
            ? current as 1 | 2 | 3
            : (numeros[0] ?? 1)
        setTrimestreSelecionado(chosen)
      } catch (cause) {
        if (active) {
          setPeriodosAtivos([])
          setPeriodosDetalhes([])
          setPeriodosError(cause instanceof Error ? cause.message : "Não foi possível carregar os trimestres.")
        }
      } finally {
        if (active) setLoadingPeriodos(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [turmaId, anoLetivoId, periodosRetry, requestedTrimestre, requestedTrimestreValid])

  const handleSaveBatch = async (rows: StudentGradeRow[]) => {
    if (gradeConflictRef.current) throw new Error("GRADE_CONFLICT: recarregue a pauta.")
    if (raaScopeRef.current !== raaScope || !pautaReady || !turmaId || !disciplinaId) throw new Error("O contexto da pauta não está disponível.")
    if (!anoLetivoId) throw new Error("Ano letivo ativo não identificado. Atualize a página e tente novamente.")
    if (academicMode !== "CURRENT") {
      throw new Error("Este ano letivo está disponível apenas para consulta.")
    }
    if (gradeMaxima === null) {
      throw new Error("Esta turma usa uma escala não numérica neste fluxo.")
    }
    if (turmaStatusFecho && turmaStatusFecho !== "ABERTO") {
      throw new Error("Turma fechada para lançamento de notas")
    }
    const trimestre = trimestreSelecionado
    const configured = new Set(gradeComponentes.map((tipo) => tipo.toUpperCase()))
    const candidates = [
      { tipo: "MAC" as const, campo: "mac1" as const },
      { tipo: "NPP" as const, campo: "npp1" as const },
      { tipo: "NPT" as const, campo: "npt1" as const },
    ]
    const payloads = configured.size === 0
      ? candidates.filter((item) => item.tipo !== "NPP")
      : candidates.filter(
          (item) => configured.has(item.tipo) || (item.tipo === "NPT" && configured.has("PT")),
        )

    for (const { tipo, campo } of payloads) {
      if (raaScopeRef.current !== raaScope) throw new Error("O contexto da pauta mudou.")
      const notas = rows.flatMap(row => {
        const baseline = baselines.current.get(row.id)
        if (!baseline || !baseline.versions || !Object.prototype.hasOwnProperty.call(baseline.versions, tipo)) {
          gradeConflictRef.current = true; setGradeConflict(true)
          throw new Error("GRADE_REVISION_REQUIRED: recarregue a pauta.")
        }
        return baseline.row[campo] === row[campo] ? [] : [{ aluno_id: row.id, matricula_id: baseline.matriculaId, valor: row[campo], expected: baseline.versions[tipo] }]
      })
      if (!notas.length) continue

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

      let versions: Record<string, GradeRevision> | null = null
      if (!online) {
        // Preserve the original revision in the offline queue. A later stale
        // edit will become an explicit 409 conflict, never overwrite silently.
        await enqueueOfflineAction(request)
      } else {
        const res = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.ok) {
          if (res.status === 409 && /GRADE_CONFLICT|GRADE_REVISION_REQUIRED/.test(String(json?.error ?? ""))) {
            gradeConflictRef.current = true; setGradeConflict(true)
          }
          throw new Error(json?.error || "Falha ao salvar notas")
        }
        versions = json?.data?.versions ?? null
        if (!versions || notas.some(nota => !versions?.[nota.matricula_id]?.id)) {
          gradeConflictRef.current = true; setGradeConflict(true)
          throw new Error("GRADE_REVISION_REQUIRED: confirme a gravação ao recarregar a pauta.")
        }
        navigation?.notifyChanged()
      }
      if (raaScopeRef.current !== raaScope) throw new Error("O contexto da pauta mudou.")
      for (const nota of notas) {
        const baseline = baselines.current.get(nota.aluno_id)!
        baseline.row = { ...baseline.row, [campo]: nota.valor }
        if (versions && baseline.versions) baseline.versions = { ...baseline.versions, [tipo]: versions[nota.matricula_id] }
      }
      const committed = new Map(notas.map(nota => [nota.aluno_id, nota.valor]))
      setPauta(previous => previous.map(row => committed.has(row.id) ? { ...row, [campo]: committed.get(row.id)! } : row))
    }

    if (online) navigation?.notifyChanged()
    setPauta((prev) =>
      prev.map((row) => {
        const updated = rows.find((candidate) => candidate.id === row.id)
        return updated ? { ...row, ...updated, _status: "synced" } : row
      })
    )
  }

  const handleSaveNow = async () => {
    if (!pautaReady || !turmaId || !disciplinaId || pauta.length === 0 || !anoLetivoId || loading) return
    if (notasBloqueadas || savingNow || !saveControl.current) return
    setSavingNow(true)
    try {
      await saveControl.current()
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

  const completionKey = `${anoLetivoId}:${turmaDisciplinaId}:${trimestreSelecionado}`
  useEffect(() => {
    if (!anoLetivoId || !turmaId || !disciplinaId || !turmaDisciplinaId || !online) return
    const controller = new AbortController()
    const params = new URLSearchParams({
      ano_letivo_id: anoLetivoId,
      turma_id: turmaId,
      disciplina_id: disciplinaId,
      turma_disciplina_id: turmaDisciplinaId,
      trimestre: String(trimestreSelecionado),
    })
    void fetch(`/api/professor/notas/concluir?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) return
      const payload = await response.json()
      if (payload?.ok && !controller.signal.aborted) {
        setCompletedScopes((current) => ({
          ...current,
          [completionKey]: Boolean(payload.already_completed) || Boolean(current[completionKey]),
        }))
      }
    }).catch(() => undefined)
    return () => controller.abort()
  }, [anoLetivoId, turmaId, disciplinaId, turmaDisciplinaId, trimestreSelecionado, online, completionKey])
  const hasUnsavedGrades = useMemo(() => {
    const persisted = new Map(pauta.map((row) => [row.id, row]))
    return gradeDraft.some((row) => {
      const saved = persisted.get(row.id)
      return row._status !== "synced" || !saved || row.mac1 !== saved.mac1 || row.npp1 !== saved.npp1 || row.npt1 !== saved.npt1 || Boolean(row.is_isento) !== Boolean(saved.is_isento)
    })
  }, [gradeDraft, pauta])

  const otherDraft = Boolean(requestReason.trim() || reapreciacaoMotivo.trim() || Object.values(examNotes).some(value => value.trim()))
  const mutationBusy = savingNow || completingGrades || savingExam || requestingReopen || submittingReapreciacao || exporting
  const contextLocked = hasUnsavedGrades || otherDraft || mutationBusy || Boolean(navigation?.busy)
  usePortalDrawerGuard(hasUnsavedGrades || otherDraft, mutationBusy)

  const handleCompleteGrades = async () => {
    if (!turmaId || !disciplinaId || !turmaDisciplinaId || !anoLetivoId || !online) {
      warning("É necessária uma ligação ativa e uma pauta selecionada.")
      return
    }
    if (loading || savingNow || hasUnsavedGrades) {
      warning("Guarde primeiro as alterações pendentes antes de concluir.")
      return
    }
    setCompletingGrades(true)
    try {
      const response = await fetch("/api/professor/notas/concluir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ano_letivo_id: anoLetivoId,
          turma_id: turmaId,
          disciplina_id: disciplinaId,
          turma_disciplina_id: turmaDisciplinaId,
          trimestre: trimestreSelecionado,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "Ainda existem notas por concluir nesta pauta.")
      }
      if (!payload.already_completed) navigation?.notifyChanged()
      setCompletedScopes((current) => ({ ...current, [completionKey]: true }))
      success(payload.already_completed ? "Lançamento já concluído" : "Lançamento concluído",
        payload.already_completed ? "A Secretaria já foi informada." : "A Secretaria e o Admin foram informados.")
    } catch (cause) {
      toastError("Não foi possível concluir", cause instanceof Error ? cause.message : "Tente novamente.")
    } finally {
      setCompletingGrades(false)
    }
  }

  const handleExportMiniPauta = async () => {
    if (!turmaId || !disciplinaId || pauta.length === 0 || !anoLetivoId || loading || savingNow || hasUnsavedGrades || notasBloqueadas || exportInFlight.current) return
    const turma = atribs.find((a) => a.turma.id === turmaId)?.turma
    const turmaNome = turma ? formatTurmaDisplayName(turma) : turmaId
    const disciplinaNomeResolved =
      disciplinaNome || atribs.find((a) => a.disciplina.id === disciplinaId)?.disciplina.nome || disciplinaId
    const hash = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`
    const emissao = new Date().toLocaleString("pt-PT")

    const alunos: MiniPautaPayload["alunos"] = pauta.map((row, index) => {
      const t = row.mt1 ?? null
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
        numero: row.numero ?? index + 1,
        nome: row.nome,
        genero: "M",
        trim1,
        trim2,
        trim3,
        mfd: null,
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
        mostrarTrimestresInativos: showInactiveTerms,
        conferencia: true,
      },
      alunos,
    }

    exportInFlight.current = true
    setExporting(true)
    try {
      await gerarMiniPauta(payload, `MiniPauta_${disciplinaNomeResolved}_${Date.now()}.pdf`)
      setExportOpen(false)
    } catch (cause) {
      toastError("Não foi possível exportar", cause instanceof Error ? cause.message : "Tente novamente.")
    } finally {
      exportInFlight.current = false
      setExporting(false)
    }
  }

  const data = loadedRows
  const reaberturaAtiva = reopenRequest?.status === "APROVADO" && Boolean(reopenRequest.expira_em) && new Date(reopenRequest.expira_em as string).getTime() > Date.now()
  const gradeAvailability = resolveGradeEntryAvailability({
    periods: periodosDetalhes,
    trimestre: trimestreSelecionado,
    academicMode,
    turmaStatusFecho,
    gradeMaxima,
    activeReopening: reaberturaAtiva,
  })
  const notasBloqueadas = !gradeAvailability.canWrite

  return (
    <div className={embedded ? "min-w-0" : "min-h-screen bg-background"}>
      <div className={embedded ? "min-w-0 space-y-4" : `${PORTAL_PAGE_INSET} max-md:px-0 max-md:py-0 space-y-4 sm:space-y-6`}>
        {!embedded && <div>
          <DashboardHeader
            title="Lançamento de Notas"
            description="Selecione turma, disciplina e trimestre. Revise e salve os lançamentos quando estiver pronto."
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Professor", href: "/professor" },
              { label: "Notas" },
            ]}
          />
        </div>}

        <div className={embedded ? "grid min-w-0 gap-4" : "grid gap-4 sm:gap-6 lg:grid-cols-[320px_1fr]"}>
          <aside className={embedded ? "hidden" : "hidden space-y-3 sm:space-y-4 relative z-10 overflow-visible md:block"}>
            {loadingAtribs ? (
              <div className="rounded-xl border border-border bg-card p-3 sm:p-4 space-y-3 animate-pulse">
                <div className="h-4 w-32 rounded-md bg-muted" />
                <div className="h-9 w-full rounded-xl bg-muted" />
                <div className="h-9 w-full rounded-xl bg-muted" />
                <div className="h-9 w-full rounded-xl bg-muted" />
                <div className="h-10 w-full rounded-xl bg-amber/20" />
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border bg-card p-3 sm:p-4 space-y-3 overflow-visible">
                  <div className="text-sm font-semibold text-foreground">Turma e disciplina</div>
                  <select
                    value={turmaId}
                    onChange={(event) => {
                      setTurmaId(event.target.value)
                      setDisciplinaId("")
                      setTurmaDisciplinaId(null)
                      setDisciplinaNome(null)
                      setPauta([])
                    }}
                    className="w-full cursor-pointer rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-amber focus:ring-4 focus:ring-amber/20"
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
                    className="w-full cursor-pointer rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-amber focus:ring-4 focus:ring-amber/20"
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
                    className="w-full cursor-pointer rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-amber focus:ring-4 focus:ring-amber/20"
                    disabled={!turmaId || loadingPeriodos || periodosAtivos.length === 0}
                  >
                    {loadingPeriodos && <option value={trimestreSelecionado}>A carregar trimestres...</option>}
                    {!loadingPeriodos && periodosAtivos.length === 0 && <option value={trimestreSelecionado}>Nenhum trimestre configurado</option>}
                    {periodosAtivos.map((periodo) => (
                      <option key={periodo} value={periodo}>
                        {`Trimestre ${periodo}`}
                      </option>
                    ))}
                  </select>
                  {turmaId && periodosError && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                      <p>{periodosError}</p>
                      <button type="button" onClick={() => setPeriodosRetry((value) => value + 1)} className="mt-2 font-bold underline">
                        Tentar novamente
                      </button>
                    </div>
                  )}
                  {turmaId && !loadingPeriodos && !periodosError && periodosAtivos.length === 0 && (
                    <p className="text-xs text-muted-foreground">A secretaria precisa configurar os trimestres deste ano letivo antes do lançamento.</p>
                  )}
                </div>
                <div className="rounded-xl border border-border bg-card p-3 sm:p-4 space-y-2 text-sm text-muted-foreground">
                  <div className="font-semibold text-foreground">Ações</div>
                  <button
                    type="button"
                    onClick={() => { setShowInactiveTerms(false); setExportOpen(true) }} aria-haspopup="dialog" aria-expanded={exportOpen}
                    disabled={!pautaReady || !turmaId || !disciplinaId || !anoLetivoId || pauta.length === 0 || exporting || loading || savingNow || hasUnsavedGrades || notasBloqueadas}
                    className="w-full rounded-xl bg-amber px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                  >
                    {exporting ? "Gerando PDF..." : "Exportar mini‑pauta"}
                  </button>
                </div>
              </>
            )}
          </aside>

          <section className="min-w-0">
            <div className={`${embedded ? "" : "md:hidden sticky top-0 z-20"} mb-3 sm:mb-4 rounded-xl border border-border bg-card/95 p-3 sm:p-4 backdrop-blur`}>
              {loadingAtribs ? (
                <div className="grid gap-3 sm:grid-cols-2 animate-pulse">
                  <div className="h-10 rounded-xl bg-muted" />
                  <div className="h-10 rounded-xl bg-muted" />
                  <div className="h-10 rounded-xl bg-muted" />
                  <div className="h-10 rounded-xl bg-muted" />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => setContextOpen(true)} disabled={contextLocked} aria-haspopup="dialog" aria-expanded={contextOpen}
                    className="klasse-portal-press flex min-h-14 min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-3 text-left disabled:opacity-50 sm:col-span-2">
                    <SlidersHorizontal className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-foreground">Turma e disciplina</span><span className="block break-words text-xs text-muted-foreground">{[atribs.find(a => a.turma.id === turmaId)?.turma ? formatTurmaDisplayName(atribs.find(a => a.turma.id === turmaId)!.turma) : null, disciplinaNome, turmaId ? trimestreSelecionado + ".º trimestre" : null].filter(Boolean).join(" · ") || "Seleccionar contexto"}</span></span>
                  </button>
                  {hasUnsavedGrades && <p className="text-xs text-muted-foreground sm:col-span-2">Guarda as notas antes de mudar o contexto.</p>}
                  <PortalSheet open={contextOpen} inline={embedded} onClose={() => setContextOpen(false)} size="expanded" title="Contexto de lançamento" description="Selecciona a turma, a disciplina e o trimestre." footer={<button type="button" onClick={() => setContextOpen(false)} className="klasse-portal-press min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Concluir selecção</button>}>
                    <div className="grid gap-3">
                  <select aria-label="Turma" disabled={contextLocked}
                    value={turmaId}
                    onChange={(event) => {
                      setTurmaId(event.target.value)
                      setDisciplinaId("")
                      setTurmaDisciplinaId(null)
                      setDisciplinaNome(null)
                      setPauta([])
                    }}
                    className="w-full cursor-pointer rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-amber focus:ring-4 focus:ring-amber/20"
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
                  <select aria-label="Disciplina"
                    value={disciplinaId}
                    onChange={(event) => {
                      const nextId = event.target.value
                      setDisciplinaId(nextId)
                      const atrib = (atribsByTurma.get(turmaId) || []).find((a) => a.disciplina.id === nextId)
                      setTurmaDisciplinaId(atrib?.turma_disciplina_id ?? null)
                      setDisciplinaNome(atrib?.disciplina.nome ?? null)
                    }}
                    className="w-full cursor-pointer rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-amber focus:ring-4 focus:ring-amber/20"
                    disabled={!turmaId || contextLocked}
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
                  <select aria-label="Trimestre"
                    value={trimestreSelecionado}
                    onChange={(event) => setTrimestreSelecionado(Number(event.target.value) as 1 | 2 | 3)}
                    className="w-full cursor-pointer rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-amber focus:ring-4 focus:ring-amber/20"
                    disabled={!turmaId || loadingPeriodos || periodosAtivos.length === 0 || contextLocked}
                  >
                    {loadingPeriodos && <option value={trimestreSelecionado}>A carregar trimestres...</option>}
                    {!loadingPeriodos && periodosAtivos.length === 0 && <option value={trimestreSelecionado}>Nenhum trimestre configurado</option>}
                    {periodosAtivos.map((periodo) => (
                      <option key={periodo} value={periodo}>
                        {`Trimestre ${periodo}`}
                      </option>
                    ))}
                  </select>
                  {turmaId && periodosError && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 sm:col-span-2">
                      <p>{periodosError}</p>
                      <button type="button" onClick={() => setPeriodosRetry((value) => value + 1)} className="mt-2 font-bold underline">
                        Tentar novamente
                      </button>
                    </div>
                  )}
                  {turmaId && !loadingPeriodos && !periodosError && periodosAtivos.length === 0 && (
                    <p className="text-xs text-muted-foreground sm:col-span-2">A secretaria precisa configurar os trimestres deste ano letivo antes do lançamento.</p>
                  )}
</div>
                  </PortalSheet>
                  <button
                    type="button"
                    onClick={handleSaveNow}
                    disabled={!pautaReady || !turmaId || !disciplinaId || pauta.length === 0 || !anoLetivoId || loading || savingNow || notasBloqueadas || Boolean(navigation?.busy)}
                    className="klasse-portal-cta w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
                  >
                    {savingNow ? "Salvando..." : "Salvar agora"}
                  </button>
                  <button type="button" aria-haspopup="dialog" aria-expanded={exportOpen} disabled={!pautaReady || !turmaId || !disciplinaId || !anoLetivoId || pauta.length === 0 || exporting || loading || savingNow || hasUnsavedGrades || notasBloqueadas} onClick={() => { setShowInactiveTerms(false); setExportOpen(true) }} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50">Exportar mini-pauta</button>
                  {turmaId && disciplinaId && (
                    <div className={`rounded-lg px-3 py-2 text-xs ${notasBloqueadas ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                      <p className="font-bold">
                        {notasBloqueadas ? "Trimestre indisponível para lançamento" : reaberturaAtiva ? "Reabertura aprovada" : "Trimestre disponível"}
                      </p>
                      <p className="mt-0.5">
                        {notasBloqueadas ? gradeAvailability.explanation : reaberturaAtiva && reopenRequest?.expira_em ? `Podes lançar até ${new Intl.DateTimeFormat("pt-AO", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Luanda" }).format(new Date(reopenRequest.expira_em))}.` : "Os lançamentos podem ser salvos."}
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
            <PortalSheet open={exportOpen} busy={exporting} inline={embedded} onClose={() => setExportOpen(false)} title="Exportar mini-pauta" description="Confirma o âmbito da mini-pauta de conferência. Não é uma pauta final." size="medium">
              <dl className="space-y-2 text-sm"><div><dt className="text-muted-foreground">Turma</dt><dd className="font-medium">{atribs.find(a => a.turma.id === turmaId)?.turma.nome ?? "—"}</dd></div><div><dt className="text-muted-foreground">Disciplina</dt><dd className="font-medium">{disciplinaNome ?? "—"}</dd></div><div><dt className="text-muted-foreground">Trimestre</dt><dd>{trimestreSelecionado}.º · {pauta.length} alunos</dd></div></dl>
              <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={showInactiveTerms} disabled={exporting} onChange={e => setShowInactiveTerms(e.target.checked)} /> Mostrar colunas dos outros trimestres (sem notas)</label>
              <button type="button" disabled={!pautaReady || exporting || loading || savingNow || hasUnsavedGrades || notasBloqueadas} onClick={() => void handleExportMiniPauta()} className="min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{exporting ? "A gerar PDF…" : "Descarregar PDF"}</button>
            </PortalSheet>
            <PortalSheet open={reopenSheet} busy={requestingReopen} inline={embedded} onClose={()=>{ if (requestingReopen || (requestReason.trim() && !window.confirm("Descartar pedido de reabertura?"))) return; setRequestReason(""); setReopenSheet(false) }} title="Solicitar reabertura" description={`${disciplinaNome ?? "Disciplina"} · ${trimestreSelecionado}.º trimestre`} size="expanded">
              <textarea aria-label="Motivo da reabertura" disabled={requestingReopen} value={requestReason} onChange={(event) => setRequestReason(event.target.value)} rows={3} placeholder="Explique por que precisa lançar ou corrigir esta nota." className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" /><button type="button" onClick={() => void handleRequestReopen()} disabled={requestingReopen || !anoLetivoId || requestReason.trim().length < 5} className="rounded-xl bg-amber px-4 py-2 font-bold text-white disabled:opacity-60">{requestingReopen ? "A enviar..." : "Solicitar reabertura"}</button>
            </PortalSheet>
            {gradeConflict && <div role="alert" className="space-y-2 rounded-xl border border-border bg-card p-3 text-sm"><p className="font-semibold">A pauta foi alterada noutra sessão ou a revisão não está disponível.</p><p className="text-muted-foreground">As alterações locais não foram sobrescritas no servidor. Confere a versão actual antes de voltar a guardar.</p><button type="button" disabled={mutationBusy || Boolean(navigation?.busy)} onClick={() => { if (window.confirm("Recarregar a pauta e descartar as alterações locais ainda não guardadas?")) setPautaReload(value => value + 1) }} className="min-h-11 rounded-xl border border-border px-3 font-semibold text-primary">Recarregar pauta</button></div>}
            {loading ? (
              <div className="rounded-xl border border-border bg-card p-3 sm:p-4 animate-pulse space-y-2">
                <div className="h-4 w-40 rounded-md bg-muted" />
                <div className="h-3 w-full rounded-md bg-muted" />
                <div className="h-3 w-5/6 rounded-md bg-muted" />
              </div>
            ) : (!pautaReady || data.length === 0) ? (
              <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                {turmaId && disciplinaId && !pautaReady ? "Pauta indisponível para o contexto seleccionado. Volte a seleccionar a turma ou disciplina." : "Selecione a turma e disciplina para carregar os alunos."}
              </div>
            ) : notasBloqueadas ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                <p className="font-bold">Lançamento de notas indisponível</p>
                <p className="mt-1">{gradeAvailability.explanation}</p>
                {!gradeAvailability.canRequestReopen ? <p className="mt-1">{reopenRequest?.status === "PENDENTE" ? "A solicitação aguarda decisão da escola." : "Consulta o calendário oficial ou selecciona outro trimestre."}</p> : reopenRequest?.status === "PENDENTE" ? <p className="mt-1">Solicitação pendente de análise pela escola.</p> : <div className="mt-4 space-y-3"><p className="text-sm text-muted-foreground">{reopenRequest?.status === "REJEITADO" ? "A solicitação anterior foi rejeitada. Envie uma nova justificativa para continuar." : reopenRequest?.status === "EXPIRADO" ? "O prazo da solicitação anterior terminou. Podes apresentar novo pedido." : reopenRequest?.status === "REVOGADO" ? "A autorização anterior foi revogada pela escola. Consulta o motivo antes de apresentar outro pedido." : "Solicite à escola a abertura temporária deste trimestre."}</p><button type="button" aria-haspopup="dialog" onClick={()=>setReopenSheet(true)} className="klasse-portal-press min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Solicitar reabertura</button></div>}
                <div className="mt-4">
                  <GradeEntryGrid
                  key={raaScope}
                  compact={embedded}
                    initialData={data}
                    title="Consultar notas"
                    subtitle={`${disciplinaNome ?? "Disciplina"} · ${trimestreSelecionado}.º trimestre`}
                    componentesAtivos={gradeComponentes}
                    pesoPorTipo={gradePesos}
                    notaMaxima={gradeMaxima ?? 20}
                    notaCorte={gradeCorte ?? 10}
                    readOnly
                  />
                </div>
                {reopenHistory.length > 0 && <details className="mt-4 rounded-xl border border-amber-200 bg-card/70 p-3"><summary className="cursor-pointer text-xs font-bold text-amber-800">Ver histórico de solicitações ({reopenHistory.length})</summary><div className="mt-3 space-y-2">{reopenHistory.map((item) => <div key={item.id} className="rounded-lg border border-border p-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><span className="font-bold text-foreground">{item.status}</span><span className="text-muted-foreground">{new Date(item.created_at).toLocaleString("pt-PT")}</span></div><p className="mt-1 text-muted-foreground">{item.motivo}</p>{item.decisao_motivo && <p className="mt-1 text-muted-foreground">Decisão: {item.decisao_motivo}</p>}</div>)}</div></details>}
              </div>
            ) : (
              <div className="space-y-3">
                {reaberturaAtiva && reopenRequest?.expira_em && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><p className="font-bold">Reabertura aprovada.</p><p>Podes lançar notas até {new Intl.DateTimeFormat("pt-AO", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Luanda" }).format(new Date(reopenRequest.expira_em))}.</p></div>}
                {turmaId && disciplinaId && pauta.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-4 ">
                    <div>
                      <p className="text-sm font-bold text-foreground">Análise RAA do aluno</p>
                      <p className="mt-1 text-xs text-muted-foreground">Consulte a elegibilidade sem sair da turma ou da disciplina atual.</p>
                    </div>
                    <button type="button" aria-haspopup="dialog" aria-expanded={raaOpen} disabled={!pautaReady || loadingRaa || submittingReapreciacao} onClick={() => setRaaOpen(true)} className="mt-3 min-h-11 rounded-xl border border-border px-4 text-sm font-semibold">Consultar aluno</button>
                    <PortalSheet open={raaOpen} busy={loadingRaa || submittingReapreciacao} inline={embedded} onClose={() => { if (submittingReapreciacao || (reapreciacaoMotivo.trim() && !window.confirm("Descartar pedido de reapreciação?"))) return; setReapreciacaoMotivo(""); setRaaOpen(false) }} title="Análise RAA do aluno" description={disciplinaNome ?? "Disciplina seleccionada"} size="expanded">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <label className="flex-1 text-xs font-semibold text-muted-foreground">Aluno<select value={raaStudentId} disabled={loadingRaa || submittingReapreciacao} onChange={(event) => { setRaaStudentId(event.target.value); setRaaResult(null); setReapreciacaoItem(null); setReapreciacaoMotivo("") }} className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-normal text-foreground"><option value="">Selecione um aluno</option>{pauta.map((student) => <option key={student.id} value={student.id}>{student.nome}</option>)}</select></label>
                      <button type="button" onClick={() => void handleLoadRaaEligibility()} disabled={!raaStudentId || loadingRaa} className="min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">{loadingRaa ? "A consultar..." : "Consultar elegibilidade"}</button>
                    </div>
                    {raaResult && (() => {
                      const result = raaResult.canonical_result
                      const formula = result?.regime?.formula_mfd
                      const formulaText = formula && typeof formula === "object" ? Object.values(formula).find((value) => typeof value === "string" && value.includes("*")) : null
                      const isPendingFormula = result?.status === "pendente_formula"
                      const statusLabel = ({ aprovado: "Aprovado", reprovado: "Não aprovado", recurso: "Recurso previsto", reprovado_por_faltas: "Resultado por faltas", reprovado_por_indisciplina: "Situação em análise", pendente_formula: "Resultado em apuramento", pendente: "Em apuramento" } as Record<string, string>)[result?.status ?? raaResult.eligibility.status] ?? "Situação em análise"
                      return <div className={`mt-3 rounded-xl border p-3 text-sm ${isPendingFormula ? "border-amber-200 bg-amber-50" : "border-border bg-muted"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-foreground">{statusLabel}</span>
                          <span className="text-xs text-muted-foreground">{raaResult.facts.quantidade_negativas} negativa(s) · {raaResult.facts.percentual_presenca == null ? "frequência pendente" : `${raaResult.facts.percentual_presenca}% presença`}</span>
                        </div>
                        {isPendingFormula ? <><p className="mt-2 font-semibold text-amber-900">O resultado final aguarda as notas do exame.</p><p className="mt-1 text-xs text-amber-800">Confirma a sessão e lança as notas do exame.</p></> : <p className="mt-2 text-xs text-muted-foreground">{raaResult.next_action}</p>}
                        {result?.regime?.codigo_regime && <details className="mt-3 rounded-xl border border-border bg-card p-3"><summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Ver critérios do resultado</summary><p className="mt-2 text-xs text-muted-foreground">Regime: {result.regime.codigo_regime}{formulaText ? ` · Fórmula: ${formulaText}` : ""}</p></details>}
                        {(result?.status === "reprovado" || raaResult.eligibility.status === "reprovado") && (
                          <div className="mt-3 rounded-lg border border-rose-200 bg-card p-3">
                            {reapreciacaoItem ? (
                              <div className="text-xs text-foreground">
                                <p className="font-black text-foreground">Reapreciação {reapreciacaoItem.estado.replace(/_/g, " ")}</p>
                                <p className="mt-1">Protocolo: <span className="font-mono font-bold">{reapreciacaoItem.protocolo_publico}</span></p>
                                <p className="mt-1">Prazo: {new Date(reapreciacaoItem.prazo_em).toLocaleString("pt-PT")}</p>
                              </div>
                            ) : (
                              <>
                                <p className="text-xs font-bold text-rose-800">Pode solicitar reapreciação deste resultado.</p>
                                <textarea value={reapreciacaoMotivo} onChange={(event) => setReapreciacaoMotivo(event.target.value)} rows={2} placeholder="Explique o motivo da reapreciação (mínimo 10 caracteres)." className="mt-2 w-full rounded-lg border border-rose-200 px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-rose-200" />
                                <button type="button" onClick={() => void handleRequestReapreciacao()} disabled={submittingReapreciacao || reapreciacaoMotivo.trim().length < 10} className="mt-2 rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">{submittingReapreciacao ? "A registar…" : "Solicitar reapreciação"}</button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    })()}
                    </PortalSheet>
                  </div>
                )}
                {turmaId && disciplinaId && (loadingRaaRisks || raaRisksLoaded || raaRisksError) && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 ">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Alunos que precisam de atenção</p>
                        <p className="mt-1 text-xs text-muted-foreground">{raaViewerScope === "school_management" ? "Pendências desta turma e disciplina." : "Pendências nas tuas turmas e disciplinas."}</p>
                      </div>
                      <span className="rounded-full bg-card px-3 py-1 text-xs font-black text-amber-900" aria-live="polite">{loadingRaaRisks ? "A atualizar…" : raaRisksError ? "Ação necessária" : `${raaRisks.length} pendência(s)`}</span>
                    </div>
                    {raaRisksError ? (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-card p-3 text-sm text-foreground">
                        <p>{raaRisksError}</p>
                        <button type="button" onClick={() => setRaaRisksRetry((value) => value + 1)} className="mt-3 min-h-11 w-full rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white sm:w-auto">Tentar novamente</button>
                      </div>
                    ) : loadingRaaRisks ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="A carregar riscos RAA">
                        {[1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg bg-card/80" />)}
                      </div>
                    ) : raaRisks.length === 0 ? (
                      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                        <p className="font-bold">Nenhum aluno exige atenção nesta turma e disciplina.</p>
                        <p className="mt-1 text-xs text-emerald-800">Continue a completar notas e frequência; o painel será atualizado quando os dados mudarem.</p>
                      </div>
                    ) : (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {raaRisks.map((item) => (
                          <button key={item.matricula_id} type="button" aria-label={`Ver elegibilidade de ${item.aluno_nome}`} disabled={!pautaReady || loadingRaa || submittingReapreciacao || !matriculaIds[item.aluno_id]} onClick={() => { setRaaOpen(true); setRaaStudentId(item.aluno_id); setRaaResult(null); setReapreciacaoItem(null); setReapreciacaoMotivo(""); void handleLoadRaaEligibility(item.aluno_id) }} className="min-h-20 rounded-lg border border-amber-200 bg-card p-3 text-left transition hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1">
                            <div className="flex items-start justify-between gap-2"><span className="min-w-0 break-words text-sm font-bold text-foreground">{item.aluno_nome}</span><span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black uppercase text-amber-800">{item.risco?.label ?? "Atenção"}</span></div>
                            <div className="mt-2 flex items-end justify-between gap-2"><p className="text-xs leading-5 text-muted-foreground">{item.risco?.action ?? "Consultar elegibilidade e completar os dados."}</p><span className="shrink-0 text-[10px] font-black uppercase text-muted-foreground">Ver detalhe →</span></div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {turmaId && disciplinaId && (loadingExamSessions || examSessions.length > 0) && (
                  <div className="rounded-xl border border-border bg-card p-4 ">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-foreground">Exames e recurso</p>
                        <p className="mt-1 text-xs text-muted-foreground">Sessões configuradas para esta turma. O lançamento permanece no contexto da disciplina selecionada.</p>
                      </div>
                      {selectedExamSession && <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${examLocked ? "bg-muted text-muted-foreground" : "bg-emerald-50 text-emerald-700"}`}>{selectedExamSession.estado}</span>}
                    </div>
                    {loadingExamSessions ? (
                      <div className="mt-3 h-10 animate-pulse rounded-xl bg-muted" />
                    ) : (
                      <div className="mt-4 space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="text-xs font-semibold text-muted-foreground">
                            Sessão
                            <select
                              value={selectedExamSessionId}
                              onChange={(event) => {
                                const next = examSessions.find((item) => item.id === event.target.value)
                                setSelectedExamSessionId(event.target.value)
                                setSelectedExamComponentId(next?.exame_componentes?.[0]?.id ?? "")
                                setExamNotes({})
                              }}
                              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-normal text-foreground"
                            >
                              {examSessions.map((session) => <option key={session.id} value={session.id}>{session.tipo.replace("_", " ")} · {session.data_inicio} a {session.data_fim}</option>)}
                            </select>
                          </label>
                          <label className="text-xs font-semibold text-muted-foreground">
                            Componente
                            <select
                              value={selectedExamComponentId}
                              onChange={(event) => setSelectedExamComponentId(event.target.value)}
                              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-normal text-foreground"
                              disabled={examLocked}
                            >
                              {(selectedExamSession?.exame_componentes ?? []).map((component) => <option key={component.id} value={component.id}>{component.codigo} · máximo {component.nota_maxima}</option>)}
                            </select>
                          </label>
                        </div>
                        {examLocked ? (
                          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Esta sessão está {selectedExamSession?.estado}. Consulte a secretaria para corrigir a configuração.</p>
                        ) : !selectedExamComponent ? (
                          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">A sessão ainda não tem componentes configurados.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-border">
                            <table className="min-w-full text-left text-sm">
                              <thead className="bg-muted text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2">Aluno</th><th className="w-32 px-3 py-2">Nota</th></tr></thead>
                              <tbody className="divide-y divide-border">
                                {pauta.map((student) => <tr key={student.id}><td className="px-3 py-2 font-medium text-foreground">{student.nome}</td><td className="px-3 py-2"><input type="number" min="0" max={selectedExamComponent.nota_maxima} step="0.01" value={examNotes[student.id] ?? ""} onChange={(event) => setExamNotes((current) => ({ ...current, [student.id]: event.target.value }))} className="w-24 rounded-lg border border-border px-2 py-1.5 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20" aria-label={`Nota de exame de ${student.nome}`} /></td></tr>)}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {!examLocked && selectedExamComponent && <button type="button" onClick={() => void handleSaveExamResults()} disabled={savingExam || !turmaDisciplinaId} className="min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">{savingExam ? "Guardando resultados..." : "Guardar resultados do exame"}</button>}
                      </div>
                    )}
                  </div>
                )}
                {academicMode === "HISTORICAL_READ" ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Ano letivo em consulta histórica. As notas estão disponíveis apenas para leitura.
                  </div>
                ) : null}
                {gradeEscala && gradeMaxima === null ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Esta turma usa uma escala não numérica. O lançamento quantitativo está indisponível.
                  </div>
                ) : null}
                <GradeEntryGrid
                  key={raaScope}
                  compact={embedded}
                  initialData={data}
                  saveControl={saveControl}
                  onDataChange={setGradeDraft}
                  subtitle={`${disciplinaNome ?? "Disciplina"} • Trimestre ${trimestreSelecionado}`}
                  onSave={handleSaveBatch}
                  onSaveError={(cause) => toastError("Não foi possível guardar", friendlyGradeError(cause))}
                  highlightId={highlightAlunoId}
                  componentesAtivos={gradeComponentes}
                  pesoPorTipo={gradePesos}
                  notaMaxima={gradeMaxima ?? 20}
                  notaCorte={gradeCorte ?? 10}
                  readOnly={academicMode !== "CURRENT" || gradeMaxima === null}
                />
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <button
                    type="button"
                    onClick={() => void handleCompleteGrades()}
                    disabled={!online || !turmaDisciplinaId || pauta.length === 0 || loading || notasBloqueadas || savingNow || completingGrades || hasUnsavedGrades || completedScopes[completionKey]}
                    className="rounded-xl bg-klasse-gold px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {completedScopes[completionKey] ? "Lançamento concluído" : completingGrades ? "A concluir..." : "Concluir lançamento"}
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {hasUnsavedGrades ? "Há notas por guardar." : "Conclua quando todas as notas da disciplina e trimestre estiverem lançadas."}
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
