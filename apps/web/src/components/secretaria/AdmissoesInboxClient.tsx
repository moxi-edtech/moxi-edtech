'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createPortal } from 'react-dom'
import useSWR from 'swr'
import {
  Search,
  MessageCircle,
  Check,
  ChevronRight,
  Clock,
  AlertCircle,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  ExternalLink,
  RefreshCw,
  X,
  Plus,
  Share2,
  Copy,
  Calendar,
  Timer,
  CreditCard,
  School
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useEscolaId } from '@/hooks/useEscolaId'
import { useToast, useConfirm } from '@/components/feedback/FeedbackSystem'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { toContextualPortalPath } from '@/lib/navigation'
const AdmissaoConversionSheet = dynamic(
  () => import('./AdmissaoConversionSheet').then((module) => module.AdmissaoConversionSheet),
  { ssr: false, loading: () => <p role="status" className="p-4 text-sm text-muted-foreground">A preparar confirmação de matrícula...</p> }
)
import { createClient } from '@/lib/supabase/client'
import { formatTurnoDisplay } from '@/utils/formatters'
import { getAdmissionInboxNextStep, type AdmissionInboxStatus } from '@/lib/admissoes/inbox-next-step'

type AdmissaoStatus = AdmissionInboxStatus

type AdmissoesRadarResponse = {
  ok: boolean;
  counts: Record<string, number>;
  items: CandidaturaListItem[];
  meta: any;
}

type CandidaturaListItem = {
  id: string
  protocolo_publico?: string | null
  nome_candidato: string
  status: AdmissaoStatus
  created_at: string
  updated_at?: string | null
  matriculado_em?: string | null
  expires_at?: string | null
  portal_reenvio_at?: string | null
  curso_id?: string | null
  classe_id?: string | null
  turma_preferencial_id?: string | null
  turno?: string | null
  dados_candidato?: Record<string, any>
  cursos?: { nome?: string | null } | null
  classes?: { nome?: string | null } | null
}

type CandidaturaDetail = CandidaturaListItem & {
  escola_id: string
  curso_id?: string | null
  classe_id?: string | null
  ano_letivo?: number | null
  turno?: string | null
  turma_preferencial_id?: string | null
  dados_candidato?: Record<string, any>
  pendencias_historico?: CandidaturaStatusLogItem[]
}

type CandidaturaStatusLogItem = {
  id: string
  created_at?: string | null
  from_status?: string | null
  to_status?: string | null
  motivo?: string | null
  metadata?: Record<string, any> | null
  actor_user_id?: string | null
  actor?: {
    user_id?: string | null
    nome?: string | null
    email?: string | null
  } | null
}

type PendingDocumentDraft = {
  id: string
  label: string
  motivo: string
  selected: boolean
  custom?: boolean
}

type DocumentCatalogItem = {
  id: string
  label: string
}

type TurmaPromocao = {
  id: string
  nome: string | null
  turma_codigo?: string | null
  turno: string | null
  vagas_disponiveis: number
  ocupacao_atual: number
  capacidade_maxima: number
  curso_id: string | null
  classe_id: string | null
  curso_nome: string | null
  classe_nome: string | null
  ano_letivo: number | null
}

// Cores de estado são semânticas; superfícies neutras seguem os tokens do Balcão.
const STATUS_CONFIG: Record<AdmissaoStatus, { label: string; color: string; bg: string }> = {
  rascunho: { label: 'Rascunho', color: 'text-muted-foreground', bg: 'bg-muted' },
  pre_candidatura: { label: 'Pré-candidatura', color: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-50 dark:bg-indigo-500/15' },
  submetida: { label: 'Nova', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-500/15' },
  documentos_reenviados: { label: 'Documentos Re-enviados', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-100 dark:bg-blue-500/20' },
  pendente: { label: 'Documentos Pendentes', color: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-50 dark:bg-rose-500/15' },
  lista_espera: { label: 'Lista de Espera', color: 'text-amber-800 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-500/15' },
  em_analise: { label: 'Em Análise', color: 'text-amber-800 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-500/15' },
  aprovada: { label: 'Aprovada', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-500/15' },
  aguardando_pagamento: { label: 'Reserva (Aguardando Pagamento)', color: 'text-amber-800 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-500/15' },
  aguardando_compensacao: { label: 'Reserva (Em Validação)', color: 'text-amber-800 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-500/15' },
  rejeitada: { label: 'Rejeitada', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-500/15' },
  arquivada: { label: 'Arquivada', color: 'text-muted-foreground', bg: 'bg-muted' },
  arquivado: { label: 'Arquivado', color: 'text-muted-foreground', bg: 'bg-muted' },
  matriculado: { label: 'Matriculado', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-100 dark:bg-emerald-500/20' },
}

const REJECTABLE_STATUSES: AdmissaoStatus[] = ['submetida', 'documentos_reenviados', 'em_analise', 'aprovada', 'aguardando_pagamento', 'aguardando_compensacao', 'pendente']
const APPROVABLE_STATUSES: AdmissaoStatus[] = ['submetida', 'em_analise', 'pendente']
const REOPENABLE_STATUSES: AdmissaoStatus[] = ['rejeitada', 'arquivada']
const ARCHIVABLE_STATUSES: AdmissaoStatus[] = ['rascunho', 'submetida', 'documentos_reenviados', 'em_analise', 'aprovada', 'aguardando_pagamento', 'aguardando_compensacao', 'pendente', 'lista_espera']
const DOCUMENT_CORRECTION_STATUSES: AdmissaoStatus[] = ['submetida', 'documentos_reenviados', 'em_analise', 'pendente', 'lista_espera']
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Dinheiro',
  TPA: 'TPA',
  TRANSFERENCIA: 'Transferência',
}

function formatPaymentMethod(value?: unknown) {
  const key = typeof value === 'string' ? value.toUpperCase() : ''
  return PAYMENT_METHOD_LABELS[key] || 'Transferência'
}

function canRejectAdmission(status: AdmissaoStatus) {
  return REJECTABLE_STATUSES.includes(status)
}

function canApproveAdmission(status: AdmissaoStatus) {
  return APPROVABLE_STATUSES.includes(status)
}

function canReopenAdmission(status: AdmissaoStatus) {
  return REOPENABLE_STATUSES.includes(status)
}

function canArchiveAdmission(status: AdmissaoStatus) {
  return ARCHIVABLE_STATUSES.includes(status)
}

function canRequestDocumentCorrection(status: AdmissaoStatus) {
  return DOCUMENT_CORRECTION_STATUSES.includes(status)
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

function displayProtocol(item: { id: string; protocolo_publico?: string | null }) {
  return item.protocolo_publico || `#${item.id.split('-')[0].toUpperCase()}`
}

function getReservaExpiraAt(item: CandidaturaDetail) {
  return (
    item.expires_at ||
    item.dados_candidato?.reserva_expira_at ||
    item.dados_candidato?.documentos?.reserva_expira_at ||
    null
  )
}

function normalizeDocumentId(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120)

  return normalized || `documento_${Date.now()}`
}

function formatLogDate(value?: string | null) {
  if (!value) return '—'
  try {
    return format(new Date(value), "dd/MM/yyyy HH:mm")
  } catch {
    return '—'
  }
}

function describeHistoryItem(item: CandidaturaStatusLogItem) {
  const tipo = item.metadata?.tipo
  if (tipo === 'DOCUMENTOS_PENDENTES' || item.to_status === 'pendente') {
    const pendencias = Array.isArray(item.metadata?.pendencias) ? item.metadata.pendencias : []
    return {
      title: 'Pendência solicitada',
      detail: pendencias.length > 0
        ? pendencias.map((p: any) => `${p.label || p.id}: ${p.motivo || 'sem motivo'}`).join(' | ')
        : item.motivo || 'Pendência documental solicitada',
    }
  }
  if (tipo === 'DOCUMENTO_REENVIADO' || item.to_status === 'documentos_reenviados') {
    return {
      title: 'Documento reenviado',
      detail: item.metadata?.document_id
        ? `${String(item.metadata.document_id).replace(/_/g, ' ')} reenviado. Pendências restantes: ${item.metadata?.pendencias_restantes ?? '—'}`
        : item.motivo || 'Documento reenviado pelo Cofre',
    }
  }
  return {
    title: item.to_status || 'Atualização',
    detail: item.motivo || 'Sem observação',
  }
}

function describeHistoryActor(item: CandidaturaStatusLogItem) {
  if (item.actor?.nome) return item.actor.nome
  if (item.actor?.email) return item.actor.email
  if (item.metadata?.source === 'PORTAL_VAULT') return 'Cofre do candidato'
  return 'Sistema'
}

async function fetchRadar(url: string): Promise<AdmissoesRadarResponse> {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || 'Falha ao carregar radar')
  return json
}

export default function AdmissoesInboxClient({
  escolaId,
  initialItems = [],
  embedded = false,
  inModal = false,
  onNewAdmission,
}: {
  escolaId: string;
  initialItems?: CandidaturaListItem[];
  embedded?: boolean;
  inModal?: boolean;
  onNewAdmission?: () => void;
}) {
  const router = useRouter()
  const { success, error: toastError } = useToast()
  // useToast returns new wrapper functions on re-render; keep detail fetching stable.
  const toastErrorRef = useRef(toastError)
  toastErrorRef.current = toastError
  const confirm = useConfirm()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { escolaSlug } = useEscolaId()
  const slugFromPath = useMemo(() => {
    const match = pathname?.match(/^\/escola\/([^/]+)/)
    return match?.[1] ?? null
  }, [pathname])
  const escolaParam = escolaSlug || slugFromPath || escolaId
  const withSlug = useCallback(
    (suffix: string) => {
      const contextualSuffix = toContextualPortalPath(suffix, pathname)
      const slug = escolaSlug || slugFromPath
      return slug ? `/escola/${slug}${contextualSuffix}` : contextualSuffix
    },
    [escolaSlug, slugFromPath, pathname]
  )

  const [selectedId, setSelectedId] = useState<string | null>(embedded ? null : searchParams?.get('id') || null)
  const turmaId = embedded ? null : searchParams?.get('turmaId')
  const initialSearch = embedded ? null : searchParams?.get('search')

  const [selectedData, setSelectedData] = useState<CandidaturaDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [search, setSearch] = useState(initialSearch || '')
  const [statusFilter, setStatusFilter] = useState<'all' | 'novas' | 'rascunhos' | 'pre_candidaturas' | 'lista_espera' | 'pendentes' | 'concluidas' | 'expirando' | 'reenviados'>('all')
  const [detailTab, setDetailTab] = useState<'resumo' | 'documentos' | 'historico'>('resumo')
  const debouncedSearch = useDebouncedValue(search.trim(), 300)
  const supabase = useMemo(() => createClient(), [])


  const [viewingDoc, setViewingDoc] = useState<{ name: string; url: string } | null>(null)

  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [isConversionOpen, setIsConversionOpen] = useState(false)
  const [isPendenciasOpen, setIsPendenciasOpen] = useState(false)
  const [isPromoteOpen, setIsPromoteOpen] = useState(false)
  const [promoteTurmas, setPromoteTurmas] = useState<TurmaPromocao[]>([])
  const [promoteTurmaId, setPromoteTurmaId] = useState('')
  const [promoteObservacao, setPromoteObservacao] = useState('')
  const [loadingPromoteTurmas, setLoadingPromoteTurmas] = useState(false)
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkPromoteOpen, setIsBulkPromoteOpen] = useState(false)
  const [bulkPromoteTurmas, setBulkPromoteTurmas] = useState<TurmaPromocao[]>([])
  const [bulkPromoteTurmaId, setBulkPromoteTurmaId] = useState('')
  const [bulkPromoteObservacao, setBulkPromoteObservacao] = useState('')
  const [loadingBulkPromoteTurmas, setLoadingBulkPromoteTurmas] = useState(false)
  const [bulkPromotionReport, setBulkPromotionReport] = useState<{
    promoted: number
    failures: Array<{ candidatura_id: string; error: string }>
  } | null>(null)
  const [pendingDraft, setPendingDraft] = useState<PendingDocumentDraft[]>([])
  const [pendingGeneralMotivo, setPendingGeneralMotivo] = useState('')
  const [documentCatalog, setDocumentCatalog] = useState<DocumentCatalogItem[]>([])
  const [pendenciaSlaHoras, setPendenciaSlaHoras] = useState(72)

  const listUrl = useMemo(() => {
    const params = new URLSearchParams({ escolaId, limit: '50', status: statusFilter })
    if (turmaId) params.set('turmaId', turmaId)
    if (debouncedSearch) params.set('q', debouncedSearch.replace(/^#/, ''))
    return `/api/secretaria/admissoes/radar?${params.toString()}`
  }, [debouncedSearch, escolaId, statusFilter, turmaId])

  const {
    data: radarData,
    isLoading,
    error: swrError,
    mutate,
  } = useSWR<AdmissoesRadarResponse>(listUrl, fetchRadar, {
    fallbackData: initialItems.length ? { ok: true, counts: {}, items: initialItems, meta: {} } : undefined,
    keepPreviousData: true,
    revalidateOnFocus: false,
    dedupingInterval: 15000,
  })

  const items = radarData?.items || []
  const counts = radarData?.counts || {}
  const loading = isLoading && items.length === 0
  const listError = swrError instanceof Error ? swrError.message : null
  const documentEntries = useMemo(() => {
    const documentos = selectedData?.dados_candidato?.documentos
    if (!documentos || typeof documentos !== 'object' || Array.isArray(documentos)) return []
    return Object.entries(documentos).filter(([, path]) => typeof path === 'string' && path.trim())
  }, [selectedData])

  const hasSelectedCandidate = Boolean(selectedId)
  // Configuração documental só é necessária após abrir uma candidatura.
  // Evita pedido extra no primeiro carregamento da fila.
  useEffect(() => {
    if (!hasSelectedCandidate) return
    let cancelled = false

    async function loadAdmissionConfig() {
      try {
        const res = await fetch(`/api/secretaria/admissoes/config?escolaId=${encodeURIComponent(escolaId)}`, {
          cache: 'no-store',
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || 'Falha ao carregar configuração')
        if (!cancelled) {
          setDocumentCatalog(Array.isArray(json?.admissoes?.documentos_admissao_catalogo) ? json.admissoes.documentos_admissao_catalogo : [])
          setPendenciaSlaHoras(Number(json?.admissoes?.pendencia_sla_horas) || 72)
        }
      } catch {
        if (!cancelled) {
          setDocumentCatalog([])
          setPendenciaSlaHoras(72)
        }
      }
    }

    loadAdmissionConfig()
    return () => {
      cancelled = true
    }
  }, [escolaId, hasSelectedCandidate])

  const filteredItems = useMemo(() => {
    const list = items.filter(item => {
      const searchLower = search.toLowerCase()
      const protocol = displayProtocol(item).replace(/^#/, '').toLowerCase()
      const matchesName = item.nome_candidato.toLowerCase().includes(searchLower)
      const normalizedSearch = searchLower.replace(/^#/, '')
      const matchesProtocol = item.id.toLowerCase().startsWith(normalizedSearch) || protocol.startsWith(normalizedSearch)
      const matchesSearch = matchesName || matchesProtocol

      let matchesStatus = false
      if (statusFilter === 'all') {
        matchesStatus = true
      } else if (statusFilter === 'novas') {
        matchesStatus = item.status === 'submetida' || item.status === 'documentos_reenviados'
      } else if (statusFilter === 'rascunhos') {
        matchesStatus = item.status === 'rascunho'
      } else if (statusFilter === 'pre_candidaturas') {
        matchesStatus = item.status === 'pre_candidatura'
      } else if (statusFilter === 'lista_espera') {
        matchesStatus = item.status === 'lista_espera'
      } else if (statusFilter === 'pendentes') {
        matchesStatus = item.status === 'em_analise' || item.status === 'aprovada' || item.status === 'rascunho' || item.status === 'pendente' || item.status === 'aguardando_pagamento' || item.status === 'aguardando_compensacao'
      } else if (statusFilter === 'concluidas') {
        matchesStatus = item.status === 'matriculado' || item.status === 'rejeitada' || item.status === 'arquivada' || item.status === 'arquivado'
      } else if (statusFilter === 'expirando') {
        matchesStatus = item.status === 'aguardando_pagamento'
      } else if (statusFilter === 'reenviados') {
        matchesStatus = item.status === 'documentos_reenviados'
      }

      return matchesSearch && matchesStatus
    })

    // PRIORIZAÇÃO: Re-uploads no topo, depois data de criação
    return [...list].sort((a, b) => {
      if (a.status === 'documentos_reenviados' && b.status !== 'documentos_reenviados') return -1
      if (a.status !== 'documentos_reenviados' && b.status === 'documentos_reenviados') return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [items, search, statusFilter])

  const visiblePreCandidaturaIds = useMemo(
    () => filteredItems.filter((item) => item.status === 'pre_candidatura').map((item) => item.id),
    [filteredItems]
  )

  const bulkSelectedItems = useMemo(
    () => filteredItems.filter((item) => bulkSelectedIds.has(item.id)),
    [bulkSelectedIds, filteredItems]
  )

  useEffect(() => {
    setBulkSelectedIds((prev) => {
      const visible = new Set(visiblePreCandidaturaIds)
      const next = new Set(Array.from(prev).filter((id) => visible.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [visiblePreCandidaturaIds])

  // Guardar e concluir são eventos distintos: nenhum seleciona outro candidato.
  const [detailRevision, setDetailRevision] = useState(0)
  const [completedCandidateId, setCompletedCandidateId] = useState<string | null>(null)

  const refreshCurrentCandidate = useCallback(async () => {
    setDetailRevision((value) => value + 1)
    await mutate()
  }, [mutate])

  const handleConversionSaved = useCallback(async () => {
    await refreshCurrentCandidate()
  }, [refreshCurrentCandidate])

  const handleConversionSuccess = useCallback(async () => {
    setCompletedCandidateId(selectedId)
    await refreshCurrentCandidate()
  }, [refreshCurrentCandidate, selectedId])

  const handleCloseConversion = useCallback(() => {
    setIsConversionOpen(false)
  }, [])

  const handleNextCandidate = useCallback(() => {
    const next = filteredItems.find((item) =>
      item.id !== selectedId &&
      !['matriculado', 'rejeitada', 'arquivada', 'arquivado'].includes(item.status)
    )
    setCompletedCandidateId(null)
    setSelectedId(next?.id ?? null)
  }, [filteredItems, selectedId])

  const publicLink = typeof window !== 'undefined'
    ? `${window.location.origin}/admissoes/${escolaParam}`
    : ''

  const handleCopyLink = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(publicLink)
        .then(() => success('Link copiado', 'O link de acesso foi copiado. Já o pode partilhar com o encarregado ou aluno.'))
        .catch(() => fallbackCopy(publicLink))
    } else {
      fallbackCopy(publicLink)
    }
  }

  const fallbackCopy = (text: string) => {
    try {
      const textArea = document.createElement("textarea")
      textArea.value = text

      // Ensure the textarea is not visible but part of the DOM
      textArea.style.position = "fixed"
      textArea.style.left = "-9999px"
      textArea.style.top = "0"
      document.body.appendChild(textArea)

      textArea.focus()
      textArea.select()

      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)

      if (successful) {
        success('Link copiado', 'O link de acesso foi copiado. Já o pode partilhar com o encarregado ou aluno.')
      } else {
        throw new Error('Fallback copy failed')
      }
    } catch (err) {
      console.error('Erro ao copiar link:', err)
      toastError('Não foi possível copiar', 'Não conseguimos copiar o link automaticamente. Por favor, selecione o texto manualmente para partilhar.')
    }
  }

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`Olá! Faça sua inscrição online na nossa escola através do link: ${publicLink}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const fetchList = useCallback(async () => {
    await mutate()
  }, [mutate])

  const fetchDetail = useCallback(async (id: string, signal: AbortSignal) => {
    setLoadingDetail(true)
    setSelectedData(null)
    try {
      const res = await fetch(`/api/secretaria/admissoes/lead?id=${encodeURIComponent(id)}`, { signal })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao carregar detalhes')
      if (!signal.aborted) setSelectedData(json.item)
    } catch (err: unknown) {
      if (!signal.aborted) {
        console.error(err)
        toastErrorRef.current('Não foi possível abrir a candidatura', 'Tente novamente selecionando a candidatura na fila.')
      }
    } finally {
      if (!signal.aborted) setLoadingDetail(false)
    }
  }, [])

  useEffect(() => { setDetailTab("resumo") }, [selectedId])

  useEffect(() => {
    if (!selectedId) {
      setSelectedData(null)
      return
    }
    const controller = new AbortController()
    void fetchDetail(selectedId, controller.signal)
    if (!embedded) {
      // A fila embutida não altera o URL do Balcão nem o contexto do aluno.
      const url = new URL(window.location.href)
      url.searchParams.set('id', selectedId)
      window.history.replaceState(window.history.state, '', url.toString())
    }
    return () => controller.abort()
  }, [selectedId, fetchDetail, embedded, detailRevision])

  const handleApprove = async () => {
    if (!selectedId || !selectedData || !canApproveAdmission(selectedData.status)) return
    const approved = await confirm({
      title: 'Aprovar candidatura',
      message: `Confirma a aprovação da candidatura de ${selectedData.nome_candidato}? O processo avançará para a etapa de matrícula ou reserva, conforme a configuração da escola.`,
      confirmLabel: 'Aprovar candidatura',
    })
    if (!approved) return
    setLoadingAction('approving')
    try {
      const res = await fetch('/api/secretaria/admissoes/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidatura_id: selectedId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Falha ao aprovar candidatura')

      const nextStatus: AdmissaoStatus =
        typeof json.status === 'string' && json.status === 'aguardando_pagamento'
          ? 'aguardando_pagamento'
          : 'aprovada'

      mutate(
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map((item) => (item.id === selectedId ? { ...item, status: nextStatus } : item))
          };
        },
        false
      )
      if (selectedData) setSelectedData({ ...selectedData, status: nextStatus })
      success(
        nextStatus === 'aguardando_pagamento' ? 'Reserva criada' : 'Candidatura aprovada',
        nextStatus === 'aguardando_pagamento'
          ? 'A candidatura ficou aguardando pagamento antes da matrícula.'
          : 'A candidatura foi aprovada para a próxima etapa.'
      )
    } catch (err: unknown) {
      toastError('Falha na aprovação', err instanceof Error ? err.message : 'Não foi possível aprovar a candidatura.')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleReject = async () => {
    if (!selectedId) return
    if (selectedData && !canRejectAdmission(selectedData.status)) {
      toastError('Ação indisponível', 'Esta candidatura já passou da fase de rejeição pela secretaria.')
      return
    }

    const motivo = await confirm({
      title: 'Rejeitar candidatura',
      message: 'Por favor, indique o motivo da rejeição. Esta informação será guardada para consulta futura.',
      inputType: 'text',
      placeholder: 'Ex: Falta de documentação obrigatória',
      confirmLabel: 'Rejeitar candidatura',
      variant: 'danger'
    })

    if (!motivo || motivo.trim().length < 3) {
      if (motivo !== null) {
        toastError('Motivo inválido', 'Por favor, indique um motivo válido com pelo menos 3 caracteres.')
      }
      return
    }

    setLoadingAction('rejecting')
    try {
      const res = await fetch('/api/secretaria/admissoes/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidatura_id: selectedId, motivo: motivo.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao rejeitar')

      mutate(
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map((item) => (item.id === selectedId ? { ...item, status: 'rejeitada' } : item))
          };
        },
        false
      )
      if (selectedData) setSelectedData({ ...selectedData, status: 'rejeitada' })
      success('Candidatura rejeitada', 'A candidatura foi marcada como rejeitada. O registo permanecerá no sistema para consulta futura.')
    } catch (err: unknown) {
      toastError('Falha na operação', 'Não foi possível rejeitar a candidatura no momento. Por favor, tente novamente.')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleReopen = async () => {
    if (!selectedId) return

    const motivo = await confirm({
      title: 'Reabrir candidatura',
      message: 'Deseja reabrir esta candidatura para análise? Ela voltará ao estado "Em Análise".',
      inputType: 'text',
      placeholder: 'Ex: Erro na rejeição anterior ou novo documento apresentado',
      confirmLabel: 'Reabrir agora',
    })

    if (!motivo) return

    setLoadingAction('reopening')
    try {
      const res = await fetch('/api/secretaria/admissoes/reabrir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidatura_id: selectedId, motivo: motivo.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao reabrir')

      await mutate()
      success('Candidatura reaberta', 'A candidatura foi reaberta com sucesso e já está disponível para análise.')
    } catch (err: unknown) {
      toastError('Falha ao reabrir', err instanceof Error ? err.message : 'Houve um erro técnico ao tentar reabrir este registo.')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleArchive = async () => {
    if (!selectedId) return

    const ok = await confirm({
      title: 'Arquivar candidatura',
      message: 'Deseja mover esta candidatura para o arquivo? Ela deixará de aparecer na fila de espera principal.',
      confirmLabel: 'Arquivar',
    })

    if (!ok) return

    const motivo = await confirm({
      title: 'Motivo do arquivamento',
      message: 'Deseja indicar um motivo para o arquivamento? (Opcional)',
      inputType: 'text',
      placeholder: 'Ex: Candidato desistiu do processo',
      confirmLabel: 'Arquivar',
    })

    setLoadingAction('archiving')
    try {
      const res = await fetch('/api/secretaria/admissoes/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidatura_id: selectedId, motivo: motivo || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao arquivar')

      // Arquivar não perde o candidato nem termina o atendimento.
      setSelectedData((current) => current?.id === selectedId ? { ...current, status: 'arquivada' } : current)
      await mutate()
      success('Candidatura arquivada', 'O processo foi arquivado. Consulte o histórico ou escolha outro candidato.')
    } catch (err: unknown) {
      toastError('Falha ao arquivar', 'Houve um erro técnico ao tentar arquivar este registo. Por favor, tente novamente.')
    } finally {
      setLoadingAction(null)
    }
  }

  const openPendenciasModal = () => {
    if (!selectedData) return

    const currentPendencias = Array.isArray(selectedData.dados_candidato?.pendencias)
      ? selectedData.dados_candidato?.pendencias
      : []
    const currentById = new Map(
      currentPendencias
        .filter((item: any) => item && typeof item === 'object' && typeof item.id === 'string')
        .map((item: any) => [item.id, item])
    )

    const catalog = documentCatalog.length > 0
      ? documentCatalog
      : [
          { id: 'bi_candidato', label: 'BI do candidato' },
          { id: 'foto_candidato', label: 'Fotografia do candidato' },
          { id: 'certificado_habilitacoes', label: 'Certificado ou declaração' },
          { id: 'bi_encarregado', label: 'BI do encarregado' },
        ]

    const baseDraft = catalog.map((doc) => {
      const current = currentById.get(doc.id) as { motivo?: string; label?: string; custom?: boolean } | undefined
      return {
        id: doc.id,
        label: current?.label || doc.label,
        motivo: current?.motivo || '',
        selected: Boolean(current),
        custom: Boolean(current?.custom),
      }
    })

    const customPendencias = currentPendencias
      .filter((item: any) => item && typeof item === 'object' && item.custom === true && typeof item.id === 'string')
      .filter((item: any) => !catalog.some((doc) => doc.id === item.id))
      .map((item: any) => ({
        id: item.id,
        label: item.label || item.id,
        motivo: item.motivo || '',
        selected: true,
        custom: true,
      }))

    setPendingDraft([...baseDraft, ...customPendencias])
    setPendingGeneralMotivo('')
    setIsPendenciasOpen(true)
  }

  const addCustomPendingDocument = () => {
    setPendingDraft((prev) => [
      ...prev,
      {
        id: `documento_${prev.length + 1}`,
        label: 'Documento em falta',
        motivo: '',
        selected: true,
        custom: true,
      },
    ])
  }

  const updatePendingDraft = (index: number, patch: Partial<PendingDocumentDraft>) => {
    setPendingDraft((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        const next = { ...item, ...patch }
        if (patch.label !== undefined) next.id = normalizeDocumentId(patch.label)
        return next
      })
    )
  }

  const handleSavePendencias = async () => {
    if (!selectedId || !selectedData) return

    const pendencias = pendingDraft
      .filter((item) => item.selected)
      .map((item) => ({
        id: normalizeDocumentId(item.id || item.label),
        label: item.label.trim(),
        motivo: item.motivo.trim(),
        custom: Boolean(item.custom),
      }))
      .filter((item) => item.id && item.label.length >= 2 && item.motivo.length >= 3)

    const selectedCount = pendingDraft.filter((item) => item.selected).length
    if (selectedCount === 0 || pendencias.length !== selectedCount) {
      toastError('Pendência incompleta', 'Selecione pelo menos um documento e indique o motivo de cada correção.')
      return
    }

    setLoadingAction('pending')
    try {
      const res = await fetch('/api/secretaria/admissoes/pendencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidatura_id: selectedId,
          motivo: pendingGeneralMotivo.trim() || undefined,
          pendencias,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || json.details || 'Falha ao marcar pendência')

      mutate(
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map((item) => (item.id === selectedId ? { ...item, status: 'pendente' } : item))
          };
        },
        false
      )
      setSelectedData({
        ...selectedData,
        status: 'pendente',
        expires_at: null,
        dados_candidato: {
          ...(selectedData.dados_candidato || {}),
          pendencias,
          pendencia_motivo: pendingGeneralMotivo.trim() || null,
        },
      })
      setIsPendenciasOpen(false)
      success('Pendência enviada', 'O candidato já pode corrigir os documentos pelo Cofre.')
    } catch (err: unknown) {
      toastError('Falha ao marcar pendência', err instanceof Error ? err.message : 'Não foi possível atualizar a candidatura.')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleAcceptReuploadedDocuments = async () => {
    if (!selectedId || !selectedData) return

    const ok = await confirm({
      title: 'Aceitar documentos re-enviados',
      message: 'Confirma que a documentação re-enviada está correta? A candidatura volta para a fila de submissões para seguir aprovação.',
      confirmLabel: 'Aceitar documentos',
    })
    if (!ok) return

    setLoadingAction('accepting_documents')
    try {
      const res = await fetch('/api/secretaria/admissoes/revisar-documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidatura_id: selectedId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || json.details || 'Falha ao aceitar documentos')

      mutate(
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map((item) => (item.id === selectedId ? { ...item, status: 'submetida' } : item))
          };
        },
        false
      )
      setSelectedData({
        ...selectedData,
        status: 'submetida',
        dados_candidato: {
          ...(selectedData.dados_candidato || {}),
          pendencias: [],
          pendencia_expira_at: null,
        },
      })
      success('Documentos aceites', 'A candidatura voltou para a fila de submissões.')
    } catch (err: unknown) {
      toastError('Falha ao aceitar documentos', err instanceof Error ? err.message : 'Não foi possível concluir a revisão.')
    } finally {
      setLoadingAction(null)
    }
  }

  const toggleBulkSelected = (id: string) => {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllVisiblePreCandidaturas = () => {
    setBulkSelectedIds((prev) => {
      const allSelected = visiblePreCandidaturaIds.length > 0 && visiblePreCandidaturaIds.every((id) => prev.has(id))
      if (allSelected) return new Set()
      return new Set(visiblePreCandidaturaIds)
    })
  }

  const getCommonInterest = (selected: CandidaturaListItem[]) => {
    const values = selected.map((item) => ({
      cursoId: item.curso_id || item.dados_candidato?.interesse?.curso_id || null,
      classeId: item.classe_id || item.dados_candidato?.interesse?.classe_id || null,
    }))
    const cursoId = values.length > 0 && values.every((item) => item.cursoId === values[0].cursoId) ? values[0].cursoId : null
    const classeId = values.length > 0 && values.every((item) => item.classeId === values[0].classeId) ? values[0].classeId : null
    return { cursoId, classeId }
  }

  const openBulkPromoteModal = async () => {
    const selected = bulkSelectedItems
    if (selected.length === 0) {
      toastError('Seleção vazia', 'Selecione pelo menos uma pré-candidatura.')
      return
    }

    const { cursoId, classeId } = getCommonInterest(selected)
    const params = new URLSearchParams({ escolaId })
    if (cursoId) params.set('cursoId', String(cursoId))
    if (classeId) params.set('classeId', String(classeId))

    setIsBulkPromoteOpen(true)
    setBulkPromoteTurmaId('')
    setBulkPromoteObservacao('')
    setBulkPromotionReport(null)
    setLoadingBulkPromoteTurmas(true)

    try {
      const res = await fetch(`/api/secretaria/admissoes/vagas?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Falha ao carregar turmas oficiais')
      const rows = Array.isArray(json?.items) ? json.items : []
      setBulkPromoteTurmas(rows)
      const firstWithCapacity = rows.find((row: TurmaPromocao) => row.vagas_disponiveis >= selected.length) ?? rows[0]
      setBulkPromoteTurmaId(firstWithCapacity?.id ?? '')
    } catch (err: unknown) {
      setBulkPromoteTurmas([])
      toastError('Falha ao carregar turmas', err instanceof Error ? err.message : 'Não foi possível carregar as turmas oficiais.')
    } finally {
      setLoadingBulkPromoteTurmas(false)
    }
  }

  const handleBulkPromotePreCandidaturas = async () => {
    const selectedIds = Array.from(bulkSelectedIds)
    if (selectedIds.length === 0 || !bulkPromoteTurmaId) return

    const idempotencyKey =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `pre-candidatura-promover-lote-${crypto.randomUUID()}`
        : `pre-candidatura-promover-lote-${Date.now()}`

    setLoadingAction('bulk_promoting')
    try {
      const res = await fetch('/api/secretaria/admissoes/promover-lote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          escola_id: escolaId,
          candidatura_ids: selectedIds,
          turma_id: bulkPromoteTurmaId,
          observacao: bulkPromoteObservacao.trim() || undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Falha ao promover lote')

      const promotedIds: string[] = Array.isArray(json?.promoted) ? json.promoted : []
      const failures: Array<{ candidatura_id: string; error: string }> = Array.isArray(json?.failures) ? json.failures : []
      const promotedSet = new Set(promotedIds)
      await mutate(
        (prev) => {
          if (!prev) return prev
          return {
            ...prev,
            items: prev.items.map((item) => promotedSet.has(item.id) ? { ...item, status: 'submetida' } : item),
          }
        },
        false
      )

      setBulkSelectedIds(new Set(selectedIds.filter((id) => !promotedSet.has(id))))
      setBulkPromotionReport({ promoted: promotedIds.length, failures })
      if (failures.length === 0) setIsBulkPromoteOpen(false)
      success(
        'Promoção em lote concluída',
        `${promotedIds.length} pré-candidatura(s) promovida(s). ${failures.length} bloqueada(s).`
      )
      if (selectedId && promotedSet.has(selectedId)) {
        await fetchDetail(selectedId, new AbortController().signal)
      }
    } catch (err: unknown) {
      toastError('Falha na promoção em lote', err instanceof Error ? err.message : 'Não foi possível promover o lote.')
    } finally {
      setLoadingAction(null)
    }
  }

  const openPromoteModal = async () => {
    if (!selectedData) return

    const interesse = selectedData.dados_candidato?.interesse || {}
    const cursoId = selectedData.curso_id || interesse.curso_id
    const classeId = selectedData.classe_id || interesse.classe_id
    const params = new URLSearchParams({ escolaId })
    if (cursoId) params.set('cursoId', String(cursoId))
    if (classeId) params.set('classeId', String(classeId))

    setIsPromoteOpen(true)
    setPromoteTurmaId('')
    setPromoteObservacao('')
    setLoadingPromoteTurmas(true)

    try {
      const res = await fetch(`/api/secretaria/admissoes/vagas?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Falha ao carregar turmas oficiais')
      const rows = Array.isArray(json?.items) ? json.items : []
      setPromoteTurmas(rows)
      const firstAvailable = rows.find((row: TurmaPromocao) => row.vagas_disponiveis > 0) ?? rows[0]
      setPromoteTurmaId(firstAvailable?.id ?? '')
    } catch (err: unknown) {
      setPromoteTurmas([])
      toastError('Falha ao carregar turmas', err instanceof Error ? err.message : 'Não foi possível carregar as turmas oficiais.')
    } finally {
      setLoadingPromoteTurmas(false)
    }
  }

  const handlePromotePreCandidatura = async () => {
    if (!selectedId || !selectedData || !promoteTurmaId) return

    const selectedTurma = promoteTurmas.find((turma) => turma.id === promoteTurmaId)
    const idempotencyKey =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `pre-candidatura-promover-${selectedId}-${crypto.randomUUID()}`
        : `pre-candidatura-promover-${selectedId}-${Date.now()}`

    setLoadingAction('promoting')
    try {
      const res = await fetch(`/api/secretaria/admissoes/${selectedId}/promover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          turma_id: promoteTurmaId,
          observacao: promoteObservacao.trim() || undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Falha ao promover pré-candidatura')

      mutate(
        (prev) => {
          if (!prev) return prev
          return {
            ...prev,
            items: prev.items.map((item) => (item.id === selectedId ? { ...item, status: 'submetida' } : item)),
          }
        },
        false
      )

      setSelectedData({
        ...selectedData,
        status: 'submetida',
        curso_id: selectedTurma?.curso_id ?? selectedData.curso_id ?? null,
        classe_id: selectedTurma?.classe_id ?? selectedData.classe_id ?? null,
        ano_letivo: selectedTurma?.ano_letivo ?? selectedData.ano_letivo ?? null,
        turno: selectedTurma?.turno ?? selectedData.turno ?? null,
        turma_preferencial_id: promoteTurmaId,
        cursos: selectedTurma?.curso_nome ? { nome: selectedTurma.curso_nome } : selectedData.cursos,
        classes: selectedTurma?.classe_nome ? { nome: selectedTurma.classe_nome } : selectedData.classes,
      })
      setIsPromoteOpen(false)
      success('Pré-candidatura promovida', 'A candidatura entrou no funil oficial para análise da secretaria.')
    } catch (err: unknown) {
      toastError('Falha na promoção', err instanceof Error ? err.message : 'Não foi possível promover a pré-candidatura.')
    } finally {
      setLoadingAction(null)
    }
  }

  const openWhatsApp = (phone?: string) => {
    if (!phone) return
    const cleanPhone = phone.replace(/\D/g, '')
    // Add prefix if missing (assuming Angola +244)
    const finalPhone = cleanPhone.length === 9 ? `244${cleanPhone}` : cleanPhone
    window.open(`https://wa.me/${finalPhone}`, '_blank')
  }

  const handleViewDoc = async (name: string, path: string) => {
    const trimmedPath = path?.trim();
    if (!trimmedPath) return;

    try {
      // Se já for uma URL completa (ex: começa com http), usamos direto
      if (trimmedPath.startsWith('http')) {
        setViewingDoc({ name, url: trimmedPath });
        return;
      }

      const { data, error } = await supabase.storage
        .from('candidaturas')
        .createSignedUrl(trimmedPath, 3600); // 1 hora de validade

      if (error) throw error;
      if (!data?.signedUrl) throw new Error('Signed URL empty');
      
      setViewingDoc({ name, url: data.signedUrl });
    } catch (err: unknown) {
      console.error('[handleViewDoc] Error:', err);
      toastError('Erro ao visualizar', 'Não foi possível gerar um link seguro para este documento.');
    }
  };

  const selectedNextStep = selectedData
    ? getAdmissionInboxNextStep(
        completedCandidateId === selectedId ? 'matriculado' : selectedData.status,
        detailTab,
      )
    : null

  const handleNextAction = () => {
    if (!selectedData || !selectedNextStep || loadingAction) return
    switch (selectedNextStep.action) {
      case 'share_link':
        handleCopyLink()
        break
      case 'promote':
        void openPromoteModal()
        break
      case 'review_documents':
        setDetailTab('documentos')
        break
      case 'review_history':
        setDetailTab('historico')
        break
      case 'approve':
        void handleApprove()
        break
      case 'accept_documents':
        void handleAcceptReuploadedDocuments()
        break
      case 'convert':
        setIsConversionOpen(true)
        break
      case 'next_candidate':
        handleNextCandidate()
        break
    }
  }

  return (
    <div className={`flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:flex-row ${embedded ? "h-[min(69dvh,760px)] min-h-[420px]" : "h-[calc(100dvh-160px)] min-h-[560px]"}`} aria-label="Gestão de admissões">
      {/* Coluna Esquerda: Fila de Espera (30%) */}
      <div className={`min-h-0 w-full shrink-0 flex-col border-b border-border bg-card lg:w-[min(38%,400px)] lg:border-b-0 lg:border-r ${selectedId ? "hidden lg:flex" : "flex"}`}>
        <div className="border-b border-border bg-card p-3 sm:p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-foreground">Candidaturas</h2>
            <div className="flex items-center gap-2">
              {turmaId && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-[10px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2"
                  onClick={() => {
                    const url = new URL(window.location.href)
                    url.searchParams.delete('turmaId')
                    url.searchParams.delete('search')
                    router.push(url.pathname)
                  }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpar Filtro
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                aria-label="Atualizar candidaturas"
                title="Atualizar candidaturas"
                onClick={() => fetchList()}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1 bg-amber text-amber-950 hover:brightness-95"
                aria-label="Iniciar nova candidatura"
                onClick={() => onNewAdmission ? onNewAdmission() : router.push(withSlug(`/secretaria/admissoes/nova`))}
              >
                <Plus className="h-4 w-4" />
                <span>Nova</span>
              </Button>
            </div>
          </div>

          <details open={!embedded} className="mb-3 rounded-xl border border-border bg-muted/40 text-foreground">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">Partilhar link de inscrição</summary>
            <div className="border-t border-border p-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1">
              <Share2 className="h-3 w-3" />
              Link de Inscrição Pública
            </p>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 truncate rounded-xl border border-border bg-card px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                {publicLink}
              </div>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1 px-2 py-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground text-[10px] font-bold"
                title="Copiar Link"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copiar</span>
              </button>
              <button
                onClick={handleShareWhatsApp}
                className="flex items-center gap-1 px-2 py-1.5 hover:bg-[#25D366]/10 rounded-lg transition-colors text-[#25D366] text-[10px] font-bold"
                title="Partilhar no WhatsApp"
              >
                <MessageCircle className="h-3.5 w-3.5 fill-[#25D366]/10" />
                <span>WhatsApp</span>
              </button>
            </div>
            </div>
          </details>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Pesquisar candidatura..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-4 text-sm text-foreground outline-none transition-all focus:border-amber focus:ring-4 focus:ring-amber/20"
            />
          </div>

          <div className="mb-3 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
            {([
              { id: 'all', label: 'Todas' },
              { id: 'novas', label: 'Novas' },
              { id: 'rascunhos', label: 'Rascunhos' },
              { id: 'pre_candidaturas', label: 'Pré' },
              { id: 'lista_espera', label: 'Lista' },
              { id: 'pendentes', label: 'Pendentes' },
              { id: 'concluidas', label: 'Concluídas' },
            ] as const).map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`shrink-0 rounded-xl px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all ${
                  statusFilter === f.id
                    ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {statusFilter === 'pre_candidaturas' && (
            <div className="mb-4 rounded-xl border border-indigo-100 dark:border-indigo-500/25 bg-indigo-50 dark:bg-indigo-500/10 p-3">
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-[11px] font-bold text-indigo-800 dark:text-indigo-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-indigo-300"
                    checked={visiblePreCandidaturaIds.length > 0 && visiblePreCandidaturaIds.every((id) => bulkSelectedIds.has(id))}
                    onChange={toggleAllVisiblePreCandidaturas}
                  />
                  Selecionar visíveis
                </label>
                <Button
                  size="sm"
                  type="button"
                  onClick={openBulkPromoteModal}
                  disabled={bulkSelectedIds.size === 0 || !!loadingAction}
                  className="bg-amber text-amber-950 hover:brightness-95"
                >
                  <School className="h-4 w-4" />
                  Promover ({bulkSelectedIds.size})
                </Button>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-indigo-700 dark:text-indigo-300">
                A promoção em lote exige uma turma oficial com capacidade para todos os selecionados.
              </p>
            </div>
          )}

          {/* Indicadores secundários disponíveis sem sobrecarregar a fila */}
          <details open={!embedded} className="mt-1 rounded-xl border border-border bg-card">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">Indicadores e oportunidades</summary>
          <div className="grid grid-cols-2 gap-2 border-t border-border p-2">
            <button
              onClick={() => setStatusFilter('expirando')}
              className={`p-3 rounded-xl border text-left transition-all ${
                statusFilter === 'expirando'
                  ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 ring-2 ring-amber-100 dark:ring-amber-500/20'
                  : 'bg-card border-border hover:border-border'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Timer className={`h-3 w-3 ${counts.expirando > 0 ? 'text-amber-700 dark:text-amber-300 animate-pulse' : 'text-muted-foreground'}`} />
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Expirando</span>
              </div>
              <p className={`text-lg font-black ${counts.expirando > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`}>
                {counts.expirando || 0}
              </p>
            </button>
            <button
              onClick={() => setStatusFilter('reenviados')}
              className={`p-3 rounded-xl border text-left transition-all ${
                statusFilter === 'reenviados'
                  ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 ring-2 ring-blue-100 dark:ring-blue-500/20'
                  : 'bg-card border-border hover:border-border'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className={`h-3 w-3 ${counts.reenviados > 0 ? 'text-blue-600' : 'text-muted-foreground'}`} />
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Re-enviados</span>
              </div>
              <p className={`text-lg font-black ${counts.reenviados > 0 ? 'text-blue-700 dark:text-blue-300' : 'text-muted-foreground'}`}>
                {counts.reenviados || 0}
              </p>
            </button>
            <button
              onClick={() => setStatusFilter('lista_espera')}
              className={`p-3 rounded-xl border text-left transition-all col-span-2 ${
                statusFilter === 'lista_espera'
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 ring-2 ring-emerald-100'
                  : counts.oportunidades_espera > 0 ? 'bg-emerald-50/50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/25 hover:border-emerald-200 dark:hover:border-emerald-500/40' : 'bg-card border-border hover:border-border'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Check className={`h-3 w-3 ${counts.oportunidades_espera > 0 ? 'text-emerald-600 animate-bounce' : 'text-muted-foreground'}`} />
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Vagas Disponíveis</span>
              </div>
              <p className={`text-sm font-bold ${counts.oportunidades_espera > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}`}>
                {counts.oportunidades_espera > 0
                  ? `${counts.oportunidades_espera} candidatos podem ser promovidos`
                  : 'Nenhuma vaga aberta para espera'}
              </p>
            </button>
          </div>
          </details>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/30 p-3">
          {listError ? (
            <div role="alert" className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
              <p>Não foi possível carregar a fila: {listError}</p>
              <button type="button" className="mt-2 font-bold underline" onClick={() => void fetchList()}>Tentar novamente</button>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center h-32 space-y-2">
              <Spinner size={16} />
              <p className="text-xs text-muted-foreground">Carregando fila...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-sm text-muted-foreground">Nenhuma candidatura encontrada.</p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isActive = selectedId === item.id
              const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.rascunho
              const nextForList = getAdmissionInboxNextStep(item.status)
              const isBulkSelectable = statusFilter === 'pre_candidaturas' && item.status === 'pre_candidatura'
              const isBulkSelected = bulkSelectedIds.has(item.id)

              return (
                <div
                  key={item.id}
                                    role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  aria-label={`Abrir candidatura de ${item.nome_candidato}`}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      setSelectedId(item.id)
                    }
                  }}
                  onClick={() => setSelectedId(item.id)}
                  className={`group relative p-4 rounded-xl cursor-pointer transition-all border ${
                    isActive
                      ? 'bg-card border-amber shadow-sm ring-1 ring-amber/20'
                      : 'bg-card border-border hover:border-amber/50'
                  }`}
                >
                  <div className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold ${status.bg} ${status.color}`}>
                    {status.label}
                  </div>

                  {isBulkSelectable && (
                    <input
                      type="checkbox"
                      checked={isBulkSelected}
                      onChange={(event) => {
                        event.stopPropagation()
                        toggleBulkSelected(item.id)
                      }}
                      onClick={(event) => event.stopPropagation()}
                      className="absolute left-3 top-4 h-4 w-4 rounded border-indigo-300"
                    />
                  )}

                  <div className={isBulkSelectable ? "pl-7 pr-16" : "pr-16"}>
                    <p className="font-sans text-sm font-bold text-foreground transition-colors group-hover:text-emerald">
                      {item.nome_candidato}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground mt-1 uppercase tracking-wider">
                      {displayProtocol(item)} • {item.classes?.nome || '—'} • {item.cursos?.nome || '—'}
                    </p>
                  </div>

                  <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                    A seguir: <span className="text-foreground">{nextForList.listLabel}</span>
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(item.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                    </span>
                    <ChevronRight className={`h-4 w-4 transition-transform ${isActive ? 'translate-x-1 text-amber' : 'text-muted-foreground'}`} />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Coluna Direita: Raio-X (70%) */}
      <div className={`relative min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-muted/30 ${selectedId ? "flex" : "hidden lg:flex"}`}>
        <AnimatePresence mode="wait">
          {selectedId ? (
            <motion.div
              key={selectedId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col h-full overflow-y-auto"
            >
              <div className="border-b border-border bg-card px-4 py-3 lg:hidden">
                <button type="button" onClick={() => setSelectedId(null)} className="text-sm font-bold text-foreground">← Voltar às candidaturas</button>
              </div>
              {loadingDetail ? (
                <div className="flex-1 flex items-center justify-center">
                  <Spinner />
                </div>
              ) : selectedData ? (
                <>
                  {/* Cabeçalho Raio-X */}
                  <div className="border-b border-border bg-card p-4 sm:p-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant="outline" className="font-mono text-[10px] uppercase border-amber/30 text-amber-700 dark:text-amber-300">
                            Protocolo: {displayProtocol(selectedData)}
                          </Badge>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_CONFIG[selectedData.status]?.bg || 'bg-muted'} ${STATUS_CONFIG[selectedData.status]?.color || 'text-muted-foreground'}`}>
                            {STATUS_CONFIG[selectedData.status]?.label || selectedData.status}
                          </span>
                          {selectedData.status === 'documentos_reenviados' && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                              Revisão atribuída à Secretaria
                            </span>
                          )}
                        </div>
                        {selectedData.status === 'lista_espera' && (
                          <p className="mb-3 max-w-2xl rounded-xl bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                            Esta candidatura entrou em lista de espera porque a turma selecionada estava lotada no momento da submissão.
                          </p>
                        )}
                        <h1 className="font-sans text-xl font-bold leading-tight text-foreground">
                          {selectedData.nome_candidato}
                        </h1>
                        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          Submetido em {format(new Date(selectedData.created_at), "PPP", { locale: ptBR })}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {selectedData.dados_candidato?.responsavel_contato && (
                          <button
                            onClick={() => {
                              const contato = selectedData.dados_candidato?.responsavel_contato;
                              if (contato) openWhatsApp(contato);
                            }}
                            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                          >
                            <MessageCircle className="h-4 w-4 text-green-600" />
                            WhatsApp
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Orientação compacta, específica do estado, sem tirar o atendente do Balcão */}
                  {selectedNextStep && (
                    <section aria-label="Próxima ação da candidatura" className="mx-3 mt-3 rounded-xl border border-border bg-muted/40 p-3 sm:mx-5 sm:mt-4 sm:p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Próxima ação</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{selectedNextStep.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{selectedNextStep.description}</p>
                    </section>
                  )}

                  {/* Conteúdo Raio-X */}
                  <div className="space-y-4 p-3 pb-28 sm:p-5 sm:pb-28">
                    <div role="tablist" aria-label="Detalhes da candidatura" className="flex gap-1 overflow-x-auto border-b border-border pb-2">
                      {([
                        { id: 'resumo', label: 'Resumo' },
                        { id: 'documentos', label: 'Documentos' },
                        { id: 'historico', label: 'Histórico' },
                      ] as const).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          id={`admission-tab-${tab.id}`}
                          aria-controls={`admission-panel-${tab.id}`}
                          aria-selected={detailTab === tab.id}
                          onClick={() => setDetailTab(tab.id)}
                          className={`min-h-10 shrink-0 rounded-lg px-4 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber ${detailTab === tab.id ? 'bg-muted text-foreground ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div role="tabpanel" id={`admission-panel-${detailTab}`} aria-labelledby={`admission-tab-${detailTab}`} className="space-y-4">
                    {/* Alerta de Conciliação Financeira */}
                    {detailTab === 'resumo' && (selectedData.status === 'aguardando_compensacao' || selectedData.status === 'aguardando_pagamento') && (
                      <section className="bg-amber-50 dark:bg-amber-500/10 p-6 rounded-2xl border-2 border-amber-200 dark:border-amber-500/30 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-black text-amber-900 dark:text-amber-200 uppercase tracking-widest flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Conciliação Financeira
                          </h3>
                          <Badge className="bg-amber-200 dark:bg-amber-500/25 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-500/40">
                            {selectedData.status === 'aguardando_compensacao' ? 'Comprovativo Enviado' : 'Aguardando Talão'}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <DataField
                              label="Valor Declarado"
                              value={selectedData.dados_candidato?.pagamento?.amount ? `${Number(selectedData.dados_candidato.pagamento.amount).toLocaleString('pt-AO')} Kz` : 'Não informado'}
                            />
                            <DataField
                              label="Referência/Talão"
                              value={selectedData.dados_candidato?.pagamento?.referencia || 'Sem referência'}
                            />
                            <DataField
                              label="Método"
                              value={formatPaymentMethod(selectedData.dados_candidato?.pagamento?.metodo)}
                            />
                          </div>

                          <div className="flex flex-col gap-2">
                            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-widest">Documento de Prova</p>
                            {(() => {
                              const compPath = selectedData.dados_candidato?.pagamento?.comprovativo_path || selectedData.dados_candidato?.pagamento?.comprovativo_url;
                              if (!compPath) return (
                                <div className="flex items-center justify-center w-full py-4 bg-amber-100/50 dark:bg-amber-500/15 border-2 border-dashed border-amber-200 dark:border-amber-500/30 rounded-xl text-amber-500 text-xs italic">
                                  Nenhum talão anexado pelo aluno
                                </div>
                              );
                              return (
                                <button
                                  onClick={() => handleViewDoc('Comprovativo', compPath)}
                                  className="flex items-center justify-center gap-2 w-full py-4 bg-card border-2 border-dashed border-amber-300 dark:border-amber-500/40 rounded-xl text-amber-700 dark:text-amber-300 font-bold hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-all group"
                                >
                                  <FileText className="h-5 w-5 group-hover:scale-110 transition-transform" />
                                  Visualizar Talão Agora
                                </button>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                          <Button
                            className="h-11 w-full rounded-xl bg-amber font-bold text-amber-950 transition hover:brightness-95"
                            onClick={() => setIsConversionOpen(true)}
                          >
                            {selectedData.status === 'aguardando_compensacao' ? 'Validar Pagamento e Matricular' : 'Registar Pagamento e Matricular'}
                          </Button>
                        </div>
                      </section>
                    )}

                    {/* Grid de Dados */}
                    <div className={detailTab === 'resumo' ? 'grid grid-cols-1 gap-4 lg:grid-cols-2' : 'grid grid-cols-1 gap-4'}>
                      {detailTab === 'resumo' && (<>
                      {/* Dados Pessoais */}
                      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Dados do candidato
                        </h3>
                        <div className="space-y-4">
                          <DataField label="Documento" value={`${selectedData.dados_candidato?.tipo_documento || '—'}: ${selectedData.dados_candidato?.numero_documento || selectedData.dados_candidato?.bi_numero || '—'}`} />
                          <DataField label="Nascimento" value={selectedData.dados_candidato?.data_nascimento ? format(new Date(selectedData.dados_candidato.data_nascimento), "dd/MM/yyyy") : '—'} />
                          <DataField label="Gênero" value={selectedData.dados_candidato?.sexo === 'M' ? 'Masculino' : selectedData.dados_candidato?.sexo === 'F' ? 'Feminino' : '—'} />
                          <DataField label="Endereço" value={selectedData.dados_candidato?.endereco || '—'} icon={<MapPin className="h-3 w-3" />} />
                          <DataField label="Email" value={selectedData.dados_candidato?.email || '—'} icon={<Mail className="h-3 w-3" />} />
                        </div>
                      </section>

                      {/* Encarregado */}
                      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Responsável / Encarregado
                        </h3>
                        <div className="space-y-4">
                          <DataField label="Nome" value={selectedData.dados_candidato?.responsavel_nome || '—'} />
                          <DataField label="Parentesco" value={selectedData.dados_candidato?.encarregado_relacao || '—'} />
                          <DataField label="Contacto" value={selectedData.dados_candidato?.responsavel_contato || '—'} icon={<Phone className="h-3 w-3" />} />
                          <DataField label="Email" value={selectedData.dados_candidato?.encarregado_email || '—'} icon={<Mail className="h-3 w-3" />} />
                        </div>
                      </section>

                      {/* Escolha Acadêmica */}
                      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Acadêmico
                        </h3>
                        <div className="space-y-4">
                          {selectedData.status === 'pre_candidatura' && selectedData.dados_candidato?.interesse ? (
                            <div className="rounded-xl border border-indigo-100 dark:border-indigo-500/25 bg-indigo-50 dark:bg-indigo-500/10 p-3">
                              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300">
                                Interesse declarado
                              </p>
                              <DataField label="Nível" value={selectedData.dados_candidato.interesse?.curso_nome || selectedData.cursos?.nome || '—'} />
                              <DataField label="Classe" value={selectedData.dados_candidato.interesse?.classe_nome || 'A definir'} />
                              <DataField label="Turno" value={formatTurnoDisplay(selectedData.dados_candidato.interesse?.turno) || 'A definir'} />
                              <DataField label="Ano alvo" value={selectedData.dados_candidato.interesse?.ano_alvo_label || 'Próximo ano letivo'} />
                            </div>
                          ) : null}
                          <DataField label="Curso" value={selectedData.cursos?.nome || '—'} />
                          <DataField label="Classe" value={selectedData.classes?.nome || '—'} />
                          <DataField label="Ano Letivo" value={selectedData.ano_letivo?.toString() || '—'} />
                          {selectedData.status === 'aguardando_pagamento' && (
                            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-100 dark:border-amber-500/25">
                              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300 mb-1 flex items-center gap-1">
                                <Timer size={10} />
                                Reserva Expira em
                              </p>
                              <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                                {getReservaExpiraAt(selectedData)
                                  ? format(new Date(getReservaExpiraAt(selectedData) as string), "dd/MM/yyyy HH:mm")
                                  : 'Data não definida'}
                              </p>
                            </div>
                          )}
                        </div>
                      </section>

                      </>)}
                      {detailTab === 'documentos' && (
                      <>
                      {/* Documentos */}
                      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Documentos Anexados
                        </h3>
                        <div className="flex flex-wrap gap-4">
                          {documentEntries.length > 0 ? (
                            documentEntries.map(([name, path]) => (
                              <div
                                key={name}
                                className="group relative w-24 h-32 bg-muted rounded-xl border border-border overflow-hidden hover:border-amber transition-all"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleViewDoc(name, path as string)}
                                  className="absolute inset-0 flex items-center justify-center"
                                >
                                  <FileText className="h-8 w-8 text-muted-foreground" />
                                </button>
                                <div className="absolute inset-x-0 bottom-0 truncate bg-card/90 p-2 text-center text-[8px] font-bold uppercase text-foreground">
                                  {name.replace('_', ' ')}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleViewDoc(name, path as string)}
                                  className="absolute inset-0 bg-emerald/0 group-hover:bg-emerald/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                                >
                                  <ExternalLink className="h-5 w-5 text-emerald" />
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="flex flex-col items-center justify-center w-full py-8 border-2 border-dashed border-border rounded-xl text-muted-foreground">
                              <FileText className="h-8 w-8 mb-2 opacity-50" />
                              <p className="text-xs">Nenhum documento anexado</p>
                            </div>
                          )}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                          <p className="text-xs text-muted-foreground">
                            Se houver documento inválido ou ausente, envie a pendência para o Cofre do candidato.
                          </p>
                          {canRequestDocumentCorrection(selectedData.status) && (
                            <button
                              type="button"
                              onClick={openPendenciasModal}
                              disabled={!!loadingAction}
                              className="inline-flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 disabled:opacity-50"
                            >
                              <AlertCircle className="h-4 w-4" />
                              Solicitar correção
                            </button>
                          )}
                        </div>
                      </section>

                      </>
                      )}
                      {detailTab === 'historico' && (
                      <>
                      {/* Histórico de Pendências */}
                      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:col-span-2">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Histórico de Pendências
                        </h3>
                        {selectedData.pendencias_historico && selectedData.pendencias_historico.length > 0 ? (
                          <div className="space-y-3">
                            {selectedData.pendencias_historico.map((item) => {
                              const description = describeHistoryItem(item)
                              return (
                                <div key={item.id} className="rounded-xl border border-border bg-muted/40 p-4">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-bold text-foreground">{description.title}</p>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                      {formatLogDate(item.created_at)}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description.detail}</p>
                                  <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    Por {describeHistoryActor(item)}
                                  </p>
                                  {item.from_status || item.to_status ? (
                                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                      {item.from_status || '—'} → {item.to_status || '—'}
                                    </p>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                            Nenhuma pendência documental registada.
                          </div>
                        )}
                      </section>
                      </>
                      )}
                    </div>
                    </div>
                  </div>

                  {/* Uma única próxima ação principal; outras decisões continuam explícitas */}
                  <div className="absolute inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 p-3 backdrop-blur">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {canRequestDocumentCorrection(selectedData.status) && (
                        <button type="button" onClick={openPendenciasModal} disabled={!!loadingAction}
                          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-50">
                          <FileText className="h-4 w-4" />
                          Pedir ajustes
                        </button>
                      )}
                      {(canReopenAdmission(selectedData.status) || canArchiveAdmission(selectedData.status) || canRejectAdmission(selectedData.status)) && (
                        <details className="group relative">
                          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber">
                            Mais ações <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                          </summary>
                          <div className="absolute bottom-full right-0 z-20 mb-2 flex w-48 flex-col gap-1 rounded-xl border border-border bg-card p-2 shadow-xl">
                            {canReopenAdmission(selectedData.status) && (
                              <button type="button" onClick={handleReopen} disabled={!!loadingAction}
                                className="rounded-lg px-3 py-2 text-left text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50">
                                Reabrir candidatura
                              </button>
                            )}
                            {canArchiveAdmission(selectedData.status) && (
                              <button type="button" onClick={handleArchive} disabled={!!loadingAction}
                                className="rounded-lg px-3 py-2 text-left text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50">
                                Arquivar candidatura
                              </button>
                            )}
                            {canRejectAdmission(selectedData.status) && (
                              <button type="button" onClick={handleReject} disabled={!!loadingAction}
                                className="rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-500/10">
                                Rejeitar candidatura
                              </button>
                            )}
                          </div>
                        </details>
                      )}
                      {selectedNextStep && (
                        <button type="button" onClick={handleNextAction} disabled={!!loadingAction}
                          aria-label={selectedNextStep.actionLabel}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-amber px-4 py-2 text-xs font-semibold text-amber-950 transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:opacity-50">
                          {loadingAction ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                          {selectedNextStep.actionLabel}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                <Mail className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold text-muted-foreground">Selecione uma candidatura</h3>
              <p className="mt-2 max-w-xs">Escolha uma candidatura na fila para consultar os dados, documentos, histórico e ações disponíveis.</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Portais de diálogo acima do modal do Workspace, sem herdar o seu empilhamento */}
      {typeof document !== 'undefined' && createPortal(
        <>
      {/* Modal de Promoção em Lote */}
      <AnimatePresence>
        {isBulkPromoteOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setIsBulkPromoteOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-border p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                      Operação em lote
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-foreground">
                      Promover pré-candidaturas
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Reveja os candidatos selecionados e escolha a turma oficial que receberá o lote.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBulkPromoteOpen(false)}
                    className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="max-h-[62vh] space-y-5 overflow-y-auto p-6">
                <div className="rounded-xl border border-border bg-muted/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-foreground">
                      {bulkSelectedItems.length} pré-candidatura(s) selecionada(s)
                    </p>
                    <button
                      type="button"
                      onClick={() => setBulkSelectedIds(new Set())}
                      className="text-xs font-bold text-muted-foreground hover:text-foreground"
                    >
                      Limpar seleção
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {bulkSelectedItems.slice(0, 8).map((item) => (
                      <div key={item.id} className="rounded-lg bg-card px-3 py-2 text-xs">
                        <p className="font-bold text-foreground">{item.nome_candidato}</p>
                        <p className="text-muted-foreground">
                          {item.dados_candidato?.interesse?.curso_nome || item.cursos?.nome || 'Nível não informado'}
                        </p>
                      </div>
                    ))}
                  </div>
                  {bulkSelectedItems.length > 8 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      +{bulkSelectedItems.length - 8} outros selecionados.
                    </p>
                  )}
                </div>

                {bulkPromotionReport && (
                  <div className={`rounded-xl border p-4 ${
                    bulkPromotionReport.failures.length > 0
                      ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10'
                      : 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10'
                  }`}>
                    <p className={`text-sm font-bold ${
                      bulkPromotionReport.failures.length > 0 ? 'text-amber-900 dark:text-amber-200' : 'text-emerald-900 dark:text-emerald-200'
                    }`}>
                      Relatório do lote
                    </p>
                    <p className={`mt-1 text-xs ${
                      bulkPromotionReport.failures.length > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300'
                    }`}>
                      {bulkPromotionReport.promoted} promovida(s), {bulkPromotionReport.failures.length} não promovida(s).
                    </p>
                    {bulkPromotionReport.failures.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {bulkPromotionReport.failures.map((failure) => {
                          const item = filteredItems.find((candidate) => candidate.id === failure.candidatura_id)
                          return (
                            <div key={failure.candidatura_id} className="rounded-lg bg-card px-3 py-2 text-xs">
                              <p className="font-bold text-foreground">{item?.nome_candidato || failure.candidatura_id}</p>
                              <p className="text-amber-700 dark:text-amber-300">{failure.error}</p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Turma oficial
                  </span>
                  {loadingBulkPromoteTurmas ? (
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      A carregar turmas...
                    </div>
                  ) : (
                    <select
                      value={bulkPromoteTurmaId}
                      onChange={(event) => setBulkPromoteTurmaId(event.target.value)}
                      className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20"
                    >
                      <option value="">Selecionar turma...</option>
                      {bulkPromoteTurmas.map((turma) => (
                        <option key={turma.id} value={turma.id}>
                          {turma.nome || turma.turma_codigo || 'Turma'} · {turma.classe_nome || 'Classe'} · {formatTurnoDisplay(turma.turno) || 'Turno'} · {turma.ano_letivo || 'Ano'} · {turma.vagas_disponiveis} vaga(s)
                        </option>
                      ))}
                    </select>
                  )}
                </label>

                {bulkPromoteTurmaId ? (
                  <div className="rounded-xl border border-border bg-muted/50 p-4">
                    {(() => {
                      const turma = bulkPromoteTurmas.find((item) => item.id === bulkPromoteTurmaId)
                      if (!turma) return null
                      const insufficientCapacity = turma.capacidade_maxima > 0 && turma.vagas_disponiveis < bulkSelectedItems.length
                      return (
                        <div className="space-y-3">
                          <div className="grid gap-3 md:grid-cols-3">
                            <DataField label="Curso" value={turma.curso_nome || '—'} />
                            <DataField label="Classe" value={turma.classe_nome || '—'} />
                            <DataField label="Turno" value={formatTurnoDisplay(turma.turno) || '—'} />
                            <DataField label="Ano letivo" value={turma.ano_letivo?.toString() || '—'} />
                            <DataField label="Ocupação" value={`${turma.ocupacao_atual}/${turma.capacidade_maxima}`} />
                            <DataField label="Vagas" value={turma.vagas_disponiveis.toString()} />
                          </div>
                          {insufficientCapacity && (
                            <div className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
                              Esta turma não tem vagas suficientes para os {bulkSelectedItems.length} selecionados. Reduza o lote ou escolha outra turma.
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                ) : null}

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Observação
                  </span>
                  <textarea
                    value={bulkPromoteObservacao}
                    onChange={(event) => setBulkPromoteObservacao(event.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20"
                    placeholder="Ex: Lote promovido após abertura oficial do ano letivo."
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-border p-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsBulkPromoteOpen(false)}
                  disabled={loadingAction === 'bulk_promoting'}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleBulkPromotePreCandidaturas}
                  disabled={
                    !bulkPromoteTurmaId ||
                    loadingBulkPromoteTurmas ||
                    loadingAction === 'bulk_promoting' ||
                    (() => {
                      const turma = bulkPromoteTurmas.find((item) => item.id === bulkPromoteTurmaId)
                      return Boolean(turma && turma.capacidade_maxima > 0 && turma.vagas_disponiveis < bulkSelectedItems.length)
                    })()
                  }
                  className="bg-amber text-amber-950 hover:brightness-95"
                >
                  {loadingAction === 'bulk_promoting' ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <School className="mr-2 h-4 w-4" />}
                  Promover lote
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Promoção de Pré-candidatura */}
      <AnimatePresence>
        {isPromoteOpen && selectedData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setIsPromoteOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-2xl rounded-xl border border-border bg-card text-foreground shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-border p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                      Pré-candidatura
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-foreground">
                      Promover para candidatura oficial
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Escolha uma turma real do ano letivo preparado para colocar esta candidatura no funil operacional.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPromoteOpen(false)}
                    className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <div className="rounded-xl border border-indigo-100 dark:border-indigo-500/25 bg-indigo-50 dark:bg-indigo-500/10 p-4">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300">
                    Interesse original
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <DataField
                      label="Nível"
                      value={selectedData.dados_candidato?.interesse?.curso_nome || selectedData.cursos?.nome || '—'}
                    />
                    <DataField
                      label="Ano alvo"
                      value={selectedData.dados_candidato?.interesse?.ano_alvo_label || 'Próximo ano letivo'}
                    />
                  </div>
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Turma oficial
                  </span>
                  {loadingPromoteTurmas ? (
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      A carregar turmas...
                    </div>
                  ) : (
                    <select
                      value={promoteTurmaId}
                      onChange={(event) => setPromoteTurmaId(event.target.value)}
                      className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20"
                    >
                      <option value="">Selecionar turma...</option>
                      {promoteTurmas.map((turma) => (
                        <option key={turma.id} value={turma.id}>
                          {turma.nome || turma.turma_codigo || 'Turma'} · {turma.classe_nome || 'Classe'} · {formatTurnoDisplay(turma.turno) || 'Turno'} · {turma.ano_letivo || 'Ano'} · {turma.vagas_disponiveis} vaga(s)
                        </option>
                      ))}
                    </select>
                  )}
                </label>

                {promoteTurmaId ? (
                  <div className="rounded-xl border border-border bg-muted/50 p-4">
                    {(() => {
                      const turma = promoteTurmas.find((item) => item.id === promoteTurmaId)
                      if (!turma) return null
                      return (
                        <div className="grid gap-3 md:grid-cols-2">
                          <DataField label="Curso" value={turma.curso_nome || '—'} />
                          <DataField label="Classe" value={turma.classe_nome || '—'} />
                          <DataField label="Turno" value={formatTurnoDisplay(turma.turno) || '—'} />
                          <DataField label="Ano letivo" value={turma.ano_letivo?.toString() || '—'} />
                          <DataField label="Ocupação" value={`${turma.ocupacao_atual}/${turma.capacidade_maxima}`} />
                          <DataField label="Vagas" value={turma.vagas_disponiveis.toString()} />
                        </div>
                      )
                    })()}
                  </div>
                ) : null}

                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Observação
                  </span>
                  <textarea
                    value={promoteObservacao}
                    onChange={(event) => setPromoteObservacao(event.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/20"
                    placeholder="Ex: Promovida após abertura das turmas do novo ano."
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-border p-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPromoteOpen(false)}
                  disabled={loadingAction === 'promoting'}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handlePromotePreCandidatura}
                  disabled={!promoteTurmaId || loadingPromoteTurmas || loadingAction === 'promoting'}
                  className="bg-amber text-amber-950 hover:brightness-95"
                >
                  {loadingAction === 'promoting' ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <School className="mr-2 h-4 w-4" />}
                  Promover
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Visualizador de Documentos */}
      <AnimatePresence>
        {viewingDoc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setViewingDoc(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="flex h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border bg-card p-4">
                <h3 className="font-bold text-foreground uppercase tracking-widest text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {viewingDoc.name.replace('_', ' ')}
                </h3>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X className="h-6 w-6 text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 bg-muted">
                {(() => {
                  try {
                    const urlObj = new URL(viewingDoc.url);
                    const isPdf = urlObj.pathname.toLowerCase().endsWith('.pdf');
                    
                    if (isPdf) {
                      return (
                        <iframe
                          src={viewingDoc.url}
                          className="w-full h-full border-none"
                          title={viewingDoc.name}
                        />
                      );
                    }
                  } catch (e) {
                    // Fallback if URL is invalid or simple path
                    if (viewingDoc.url.toLowerCase().includes('.pdf')) {
                      return (
                        <iframe
                          src={viewingDoc.url}
                          className="w-full h-full border-none"
                          title={viewingDoc.name}
                        />
                      );
                    }
                  }

                  return (
                    <div className="w-full h-full flex items-center justify-center p-8">
                      <img
                        src={viewingDoc.url}
                        alt={viewingDoc.name}
                        className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
                      />
                    </div>
                  );
                })()}
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-3 bg-muted/50">
                <Button variant="outline" onClick={() => window.open(viewingDoc.url, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir em nova aba
                </Button>
                <Button onClick={() => setViewingDoc(null)}>
                  Fechar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPendenciasOpen && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.96, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 16 }}
              className="w-full max-w-2xl rounded-xl border border-border bg-card text-foreground shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-border p-6">
                <div>
                  <h3 className="text-lg font-black text-foreground">Documentação Pendente</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Selecione documentos do catálogo oficial. Prazo padrão para correção: {pendenciaSlaHoras}h.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPendenciasOpen(false)}
                  className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[65vh] space-y-4 overflow-y-auto p-6">
                {pendingDraft.map((item, index) => (
                  <div key={`${item.id}-${index}`} className="rounded-xl border border-border p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(event) => updatePendingDraft(index, { selected: event.target.checked })}
                        className="mt-1 h-4 w-4 rounded border-border text-amber-700 dark:text-amber-300"
                      />
                      <div className="grid flex-1 gap-3">
                        <label className="grid gap-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Documento</span>
                          <input
                            value={item.label}
                            onChange={(event) => updatePendingDraft(index, { label: event.target.value })}
                            disabled={!item.custom}
                            className="h-10 rounded-xl border border-border px-3 text-sm font-semibold text-foreground outline-none focus:border-amber-400"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Motivo para o candidato</span>
                          <textarea
                            value={item.motivo}
                            onChange={(event) => updatePendingDraft(index, { motivo: event.target.value })}
                            rows={2}
                            placeholder="Ex: imagem ilegível, documento vencido, falta verso do BI"
                            className="resize-none rounded-xl border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-amber-400"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addCustomPendingDocument}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar documento em falta
                </button>

                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Observação interna</span>
                  <textarea
                    value={pendingGeneralMotivo}
                    onChange={(event) => setPendingGeneralMotivo(event.target.value)}
                    rows={2}
                    placeholder="Opcional. Fica no histórico interno da candidatura."
                    className="resize-none rounded-xl border border-border px-3 py-2 text-sm text-foreground outline-none focus:border-amber-400"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-border bg-muted/50 p-5">
                <Button variant="outline" onClick={() => setIsPendenciasOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSavePendencias} disabled={loadingAction === 'pending'} loading={loadingAction === 'pending'}>
                  Enviar pendência
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
        </>,
        document.body
      )}

      {isConversionOpen && <AdmissaoConversionSheet
        isOpen={isConversionOpen}
        elevated={inModal}
        onClose={handleCloseConversion}
        candidaturaId={selectedId}
        escolaId={escolaId}
        onSaved={handleConversionSaved}
        onSuccess={handleConversionSuccess}
      />}
    </div>
  )
}

function DataField({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 break-words text-sm font-medium text-foreground">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {value}
      </div>
    </div>
  )
}
