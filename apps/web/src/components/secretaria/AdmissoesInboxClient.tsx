'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { 
  Search, 
  MessageCircle, 
  Pencil, 
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
  Timer
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useEscolaId } from '@/hooks/useEscolaId'
import { useToast, useConfirm } from '@/components/feedback/FeedbackSystem'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { AdmissaoConversionSheet } from './AdmissaoConversionSheet'
import { createClient } from '@/lib/supabase/client'

type AdmissaoStatus =
  | 'rascunho'
  | 'submetida'
  | 'documentos_reenviados'
  | 'em_analise'
  | 'aprovada'
  | 'aguardando_pagamento'
  | 'aguardando_compensacao'
  | 'rejeitada'
  | 'matriculado'
  | 'pendente'
  | 'lista_espera'

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
  cursos?: { nome?: string | null } | null
  classes?: { nome?: string | null } | null
}

type CandidaturaDetail = CandidaturaListItem & {
  escola_id: string
  ano_letivo?: number | null
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

const STATUS_CONFIG: Record<AdmissaoStatus, { label: string; color: string; bg: string }> = {
  rascunho: { label: 'Rascunho', color: 'text-slate-500', bg: 'bg-slate-100' },
  submetida: { label: 'Nova', color: 'text-blue-600', bg: 'bg-blue-50' },
  documentos_reenviados: { label: 'Documentos Re-enviados', color: 'text-blue-700', bg: 'bg-blue-100' },
  pendente: { label: 'Documentos Pendentes', color: 'text-rose-700', bg: 'bg-rose-50' },
  lista_espera: { label: 'Lista de Espera', color: 'text-amber-700', bg: 'bg-amber-100' },
  em_analise: { label: 'Em Análise', color: 'text-amber-600', bg: 'bg-amber-50' },
  aprovada: { label: 'Aprovada', color: 'text-klasse-green', bg: 'bg-klasse-green/10' },
  aguardando_pagamento: { label: 'Reserva (Aguardando Pagamento)', color: 'text-amber-700', bg: 'bg-amber-100' },
  aguardando_compensacao: { label: 'Reserva (Em Validação)', color: 'text-amber-700', bg: 'bg-amber-100' },
  rejeitada: { label: 'Rejeitada', color: 'text-red-600', bg: 'bg-red-50' },
  matriculado: { label: 'Matriculado', color: 'text-klasse-green', bg: 'bg-klasse-green/20' },
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
  initialItems = []
}: { 
  escolaId: string;
  initialItems?: CandidaturaListItem[];
}) {
  const router = useRouter()
  const { success, error: toastError } = useToast()
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
    (suffix: string) => ((escolaSlug || slugFromPath) ? `/escola/${escolaSlug || slugFromPath}${suffix}` : suffix),
    [escolaSlug, slugFromPath]
  )

  const [selectedId, setSelectedId] = useState<string | null>(searchParams?.get('id') || null)
  const turmaId = searchParams?.get('turmaId')
  const initialSearch = searchParams?.get('search')

  const [selectedData, setSelectedData] = useState<CandidaturaDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [search, setSearch] = useState(initialSearch || '')
  const [statusFilter, setStatusFilter] = useState<'novas' | 'lista_espera' | 'pendentes' | 'concluidas' | 'expirando' | 'reenviados'>('novas')
  const debouncedSearch = useDebouncedValue(search.trim(), 300)
  const supabase = useMemo(() => createClient(), [])

  
  const [viewingDoc, setViewingDoc] = useState<{ name: string; url: string } | null>(null)

  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [isConversionOpen, setIsConversionOpen] = useState(false)
  const [isPendenciasOpen, setIsPendenciasOpen] = useState(false)
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
    fallbackData: { ok: true, counts: {}, items: initialItems, meta: {} },
    keepPreviousData: true,
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

  useEffect(() => {
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
  }, [escolaId])

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const searchLower = search.toLowerCase()
      const protocol = displayProtocol(item).replace(/^#/, '').toLowerCase()
      const matchesName = item.nome_candidato.toLowerCase().includes(searchLower)
      const normalizedSearch = searchLower.replace(/^#/, '')
      const matchesProtocol = item.id.toLowerCase().startsWith(normalizedSearch) || protocol.startsWith(normalizedSearch)
      const matchesSearch = matchesName || matchesProtocol
      
      let matchesStatus = false
      if (statusFilter === 'novas') {
        matchesStatus = item.status === 'submetida' || item.status === 'pendente'
      } else if (statusFilter === 'lista_espera') {
        matchesStatus = item.status === 'lista_espera'
      } else if (statusFilter === 'pendentes') {
        matchesStatus = item.status === 'em_analise' || item.status === 'aprovada' || item.status === 'rascunho'
      } else if (statusFilter === 'concluidas') {
        matchesStatus = item.status === 'matriculado' || item.status === 'rejeitada'
      } else if (statusFilter === 'expirando') {
        matchesStatus = item.status === 'aguardando_pagamento'
      } else if (statusFilter === 'reenviados') {
        matchesStatus = item.status === 'submetida' || item.status === 'pendente'
      }
      
      return matchesSearch && matchesStatus
    })
  }, [items, search, statusFilter])

  const [wasSuccess, setWasSuccess] = useState(false)

  const handleConversionSuccess = useCallback(async () => {
    await mutate()
    setWasSuccess(true)
  }, [mutate])

  const handleCloseConversion = useCallback(() => {
    setIsConversionOpen(false)
    
    if (wasSuccess) {
      // Find current index and select next pending if available
      const currentIndex = filteredItems.findIndex(item => item.id === selectedId)
      if (currentIndex !== -1 && filteredItems[currentIndex + 1]) {
        setSelectedId(filteredItems[currentIndex + 1].id)
      } else {
        setSelectedId(null)
      }
      setWasSuccess(false)
    }
  }, [wasSuccess, filteredItems, selectedId])

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

  const fetchDetail = useCallback(async (id: string) => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/secretaria/admissoes/lead?id=${id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao carregar detalhes')
      setSelectedData(json.item)
    } catch (err: unknown) {
      console.error(err)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId)
      // Update URL without refresh
      const url = new URL(window.location.href)
      url.searchParams.set('id', selectedId)
      window.history.replaceState({}, '', url.toString())
    }
  }, [selectedId, fetchDetail])

  const handleApprove = async () => {
    if (!selectedId) return
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
      
      // Remove from list or move to concluded depending on business logic
      // In this UI, concluded means matriculado or rejeitada. Let's just refresh.
      await mutate()
      setSelectedId(null)
      setSelectedData(null)
      success('Candidatura arquivada', 'A candidatura foi movida para o arquivo e já não aparece na fila de espera principal.')
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

  const openWhatsApp = (phone?: string) => {
    if (!phone) return
    const cleanPhone = phone.replace(/\D/g, '')
    // Add prefix if missing (assuming Angola +244)
    const finalPhone = cleanPhone.length === 9 ? `244${cleanPhone}` : cleanPhone
    window.open(`https://wa.me/${finalPhone}`, '_blank')
  }

  const handleViewDoc = async (name: string, path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('candidaturas')
        .createSignedUrl(path, 3600) // 1 hora de validade

      if (error) throw error
      setViewingDoc({ name, url: data.signedUrl })
    } catch (err: unknown) {
      toastError('Erro ao visualizar', 'Não foi possível gerar um link seguro para este documento.')
    }
  }

  return (
    <div className="flex h-[calc(100vh-160px)] gap-0 overflow-hidden bg-white rounded-2xl shadow-sm border border-slate-200">
      {/* Coluna Esquerda: Fila de Espera (30%) */}
      <div className="w-[350px] md:w-[30%] border-r border-slate-200 flex flex-col bg-slate-50/50">
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Inbox</h2>
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
                onClick={() => fetchList()}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button 
                size="sm" 
                className="h-8 bg-klasse-green hover:bg-klasse-green-600 text-white gap-1"
                onClick={() => router.push(withSlug(`/secretaria/admissoes/nova`))}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Novo</span>
              </Button>
            </div>
          </div>
          
          <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
              <Share2 className="h-3 w-3" />
              Link de Inscrição Pública
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-mono text-slate-500 truncate">
                {publicLink}
              </div>
              <button 
                onClick={handleCopyLink}
                className="flex items-center gap-1 px-2 py-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-500 text-[10px] font-bold"
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
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar aluno..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-klasse-gold/20 focus:border-klasse-gold rounded-xl text-sm transition-all outline-none"
            />
          </div>

          <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
            {([
              { id: 'novas', label: 'Novas' },
              { id: 'lista_espera', label: 'Lista' },
              { id: 'pendentes', label: 'Pendentes' },
              { id: 'concluidas', label: 'Concluídas' },
            ] as const).map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                  statusFilter === f.id
                    ? 'bg-white text-klasse-green shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Gargalos de Conversão */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setStatusFilter('expirando')}
              className={`p-3 rounded-xl border text-left transition-all ${
                statusFilter === 'expirando' 
                  ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-100' 
                  : 'bg-white border-slate-100 hover:border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Timer className={`h-3 w-3 ${counts.expirando > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-400'}`} />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Expirando</span>
              </div>
              <p className={`text-lg font-black ${counts.expirando > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                {counts.expirando || 0}
              </p>
            </button>
            <button
              onClick={() => setStatusFilter('reenviados')}
              className={`p-3 rounded-xl border text-left transition-all ${
                statusFilter === 'reenviados' 
                  ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100' 
                  : 'bg-white border-slate-100 hover:border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className={`h-3 w-3 ${counts.reenviados > 0 ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Re-enviados</span>
              </div>
              <p className={`text-lg font-black ${counts.reenviados > 0 ? 'text-blue-700' : 'text-slate-400'}`}>
                {counts.reenviados || 0}
              </p>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-32 space-y-2">
              <Spinner size={16} />
              <p className="text-xs text-slate-400">Carregando fila...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-sm text-slate-400">Nenhuma candidatura encontrada.</p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isActive = selectedId === item.id
              const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.rascunho
              
              return (
                <motion.div
                  key={item.id}
                  layoutId={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`group relative p-4 rounded-xl cursor-pointer transition-all border ${
                    isActive 
                      ? 'bg-white border-klasse-gold shadow-md ring-1 ring-klasse-gold/20' 
                      : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
                  }`}
                >
                  <div className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold ${status.bg} ${status.color}`}>
                    {status.label}
                  </div>
                  
                  <div className="pr-16">
                    <p className="font-sans font-bold text-slate-900 group-hover:text-klasse-green transition-colors">
                      {item.nome_candidato}
                    </p>
                    <p className="font-mono text-[11px] text-slate-500 mt-1 uppercase tracking-wider">
                      {displayProtocol(item)} • {item.classes?.nome || '—'} • {item.cursos?.nome || '—'}
                    </p>
                  </div>
                  
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(item.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                    </span>
                    <ChevronRight className={`h-4 w-4 transition-transform ${isActive ? 'translate-x-1 text-klasse-gold' : 'text-slate-300'}`} />
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      </div>

      {/* Coluna Direita: Raio-X (70%) */}
      <div className="flex-1 bg-slate-50 flex flex-col relative overflow-hidden">
        <AnimatePresence mode="wait">
          {selectedId ? (
            <motion.div 
              key={selectedId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col h-full overflow-y-auto"
            >
              {loadingDetail ? (
                <div className="flex-1 flex items-center justify-center">
                  <Spinner />
                </div>
              ) : selectedData ? (
                <>
                  {/* Cabeçalho Raio-X */}
                  <div className="p-8 bg-white border-b border-slate-200">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant="outline" className="font-mono text-[10px] uppercase border-klasse-gold/30 text-klasse-gold-600">
                            Protocolo: {displayProtocol(selectedData)}
                          </Badge>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_CONFIG[selectedData.status]?.bg || 'bg-slate-100'} ${STATUS_CONFIG[selectedData.status]?.color || 'text-slate-500'}`}>
                            {STATUS_CONFIG[selectedData.status]?.label || selectedData.status}
                          </span>
                          {selectedData.status === 'documentos_reenviados' && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                              Revisão atribuída à Secretaria
                            </span>
                          )}
                        </div>
                        {selectedData.status === 'lista_espera' && (
                          <p className="mb-3 max-w-2xl rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                            Esta candidatura entrou em lista de espera porque a turma selecionada estava lotada no momento da submissão.
                          </p>
                        )}
                        <h1 className="text-4xl font-sans font-bold text-klasse-green leading-tight">
                          {selectedData.nome_candidato}
                        </h1>
                        <p className="text-slate-500 mt-1 flex items-center gap-2">
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
                            className="flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-2xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all active:scale-95"
                          >
                            <MessageCircle className="h-5 w-5 fill-white" />
                            WhatsApp
                          </button>
                        )}
                        <Button
                          variant="outline"
                          size="lg"
                          className="rounded-2xl h-12"
                          onClick={() => setIsConversionOpen(true)}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Conteúdo Raio-X */}
                  <div className="p-8 pb-32 space-y-8">
                    {/* Grid de Dados */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Dados Pessoais */}
                      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Dados do Aluno
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
                      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
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
                      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Acadêmico
                        </h3>
                        <div className="space-y-4">
                          <DataField label="Curso" value={selectedData.cursos?.nome || '—'} />
                          <DataField label="Classe" value={selectedData.classes?.nome || '—'} />
                          <DataField label="Ano Letivo" value={selectedData.ano_letivo?.toString() || '—'} />
                          {selectedData.status === 'aguardando_pagamento' && (
                            <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1 flex items-center gap-1">
                                <Timer size={10} />
                                Reserva Expira em
                              </p>
                              <p className="text-sm font-bold text-amber-900">
                                {getReservaExpiraAt(selectedData)
                                  ? format(new Date(getReservaExpiraAt(selectedData) as string), "dd/MM/yyyy HH:mm")
                                  : 'Data não definida'}
                              </p>
                            </div>
                          )}
                        </div>
                      </section>

                      {/* Documentos */}
                      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Documentos Anexados
                        </h3>
                        <div className="flex flex-wrap gap-4">
                          {documentEntries.length > 0 ? (
                            documentEntries.map(([name, path]) => (
                              <div 
                                key={name}
                                className="group relative w-24 h-32 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden hover:border-klasse-gold transition-all"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleViewDoc(name, path as string)}
                                  className="absolute inset-0 flex items-center justify-center"
                                >
                                  <FileText className="h-8 w-8 text-slate-300" />
                                </button>
                                <div className="absolute bottom-0 inset-x-0 p-2 bg-white/90 text-[8px] font-bold text-center truncate uppercase">
                                  {name.replace('_', ' ')}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleViewDoc(name, path as string)}
                                  className="absolute inset-0 bg-klasse-green/0 group-hover:bg-klasse-green/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100"
                                >
                                  <ExternalLink className="h-5 w-5 text-klasse-green" />
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="flex flex-col items-center justify-center w-full py-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                              <FileText className="h-8 w-8 mb-2 opacity-50" />
                              <p className="text-xs">Nenhum documento anexado</p>
                            </div>
                          )}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                          <p className="text-xs text-slate-500">
                            Se houver documento inválido ou ausente, envie a pendência para o Cofre do candidato.
                          </p>
                          <button
                            type="button"
                            onClick={openPendenciasModal}
                            disabled={!!loadingAction}
                            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                          >
                            <AlertCircle className="h-4 w-4" />
                            Solicitar correção
                          </button>
                        </div>
                      </section>

                      {/* Histórico de Pendências */}
                      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Histórico de Pendências
                        </h3>
                        {selectedData.pendencias_historico && selectedData.pendencias_historico.length > 0 ? (
                          <div className="space-y-3">
                            {selectedData.pendencias_historico.map((item) => {
                              const description = describeHistoryItem(item)
                              return (
                                <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-bold text-slate-900">{description.title}</p>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                      {formatLogDate(item.created_at)}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-xs leading-relaxed text-slate-600">{description.detail}</p>
                                  <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    Por {describeHistoryActor(item)}
                                  </p>
                                  {item.from_status || item.to_status ? (
                                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                      {item.from_status || '—'} → {item.to_status || '—'}
                                    </p>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                            Nenhuma pendência documental registada.
                          </div>
                        )}
                      </section>
                    </div>
                  </div>

                  {/* Barra de Ação Sticky Bottom */}
                  <div className="absolute bottom-0 inset-x-0 p-6 bg-white/80 backdrop-blur-md border-t border-slate-200 flex items-center justify-end gap-4 z-10">
                    <button 
                      onClick={handleArchive}
                      disabled={!!loadingAction}
                      className="flex items-center gap-2 px-6 py-4 border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                      {loadingAction === 'archiving' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                      Arquivar
                    </button>

                    <button 
                      onClick={handleReject}
                      disabled={!!loadingAction}
                      className="flex items-center gap-2 px-6 py-4 border border-red-200 text-red-600 rounded-2xl font-bold hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                      {loadingAction === 'rejecting' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      Rejeitar
                    </button>
                    
                    {selectedData.status === 'documentos_reenviados' && (
                      <button
                        onClick={handleAcceptReuploadedDocuments}
                        disabled={!!loadingAction}
                        className="flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-600/20 hover:shadow-2xl hover:brightness-105 hover:scale-[1.02] transition-all active:scale-95"
                      >
                        {loadingAction === 'accepting_documents' ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                        Aceitar Documentos
                      </button>
                    )}

                    {['submetida', 'em_analise', 'pendente', 'lista_espera'].includes(selectedData.status) && (
                      <button 
                        onClick={handleApprove}
                        disabled={!!loadingAction}
                        className="flex items-center gap-3 px-10 py-4 bg-[#E3B23C] text-white rounded-2xl font-bold shadow-xl shadow-klasse-gold/20 hover:shadow-2xl hover:brightness-105 hover:scale-[1.02] transition-all active:scale-95"
                      >
                        {loadingAction === 'approving' ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                        Aprovar Candidatura
                      </button>
                    )}

                    {['aprovada', 'aguardando_pagamento', 'aguardando_compensacao'].includes(selectedData.status) && (
                      <button
                        onClick={() => setIsConversionOpen(true)}
                        disabled={!!loadingAction}
                        className="flex items-center gap-3 px-10 py-4 bg-[#E3B23C] text-white rounded-2xl font-bold shadow-xl shadow-klasse-gold/20 hover:shadow-2xl hover:brightness-105 hover:scale-[1.02] transition-all active:scale-95"
                      >
                        <Check className="h-5 w-5" />
                        Efetivar Matrícula
                      </button>
                    )}
                  </div>
                </>
              ) : null}
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                <Mail className="h-10 w-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-600">Selecione uma candidatura</h3>
              <p className="mt-2 max-w-xs">Escolha um item na fila de espera para ver o raio-x detalhado e processar a matrícula.</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal Visualizador de Documentos */}
      <AnimatePresence>
        {viewingDoc && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
            onClick={() => setViewingDoc(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl overflow-hidden w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
                <h3 className="font-bold text-slate-800 uppercase tracking-widest text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {viewingDoc.name.replace('_', ' ')}
                </h3>
                <button 
                  onClick={() => setViewingDoc(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="h-6 w-6 text-slate-500" />
                </button>
              </div>
              <div className="flex-1 bg-slate-100">
                {viewingDoc.url.toLowerCase().endsWith('.pdf') ? (
                  <iframe 
                    src={viewingDoc.url} 
                    className="w-full h-full border-none"
                    title={viewingDoc.name}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-8">
                    <img 
                      src={viewingDoc.url} 
                      alt={viewingDoc.name} 
                      className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
                    />
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.96, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 16 }}
              className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Documentação Pendente</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Selecione documentos do catálogo oficial. Prazo padrão para correção: {pendenciaSlaHoras}h.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPendenciasOpen(false)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[65vh] space-y-4 overflow-y-auto p-6">
                {pendingDraft.map((item, index) => (
                  <div key={`${item.id}-${index}`} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(event) => updatePendingDraft(index, { selected: event.target.checked })}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-600"
                      />
                      <div className="grid flex-1 gap-3">
                        <label className="grid gap-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Documento</span>
                          <input
                            value={item.label}
                            onChange={(event) => updatePendingDraft(index, { label: event.target.value })}
                            disabled={!item.custom}
                            className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-amber-400"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Motivo para o candidato</span>
                          <textarea
                            value={item.motivo}
                            onChange={(event) => updatePendingDraft(index, { motivo: event.target.value })}
                            rows={2}
                            placeholder="Ex: imagem ilegível, documento vencido, falta verso do BI"
                            className="resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addCustomPendingDocument}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar documento em falta
                </button>

                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Observação interna</span>
                  <textarea
                    value={pendingGeneralMotivo}
                    onChange={(event) => setPendingGeneralMotivo(event.target.value)}
                    rows={2}
                    placeholder="Opcional. Fica no histórico interno da candidatura."
                    className="resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 p-5">
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

      <AdmissaoConversionSheet 
        isOpen={isConversionOpen}
        onClose={handleCloseConversion}
        candidaturaId={selectedId}
        escolaId={escolaId}
        onSuccess={handleConversionSuccess}
      />
    </div>
  )
}

function DataField({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
      <div className="flex items-center gap-2 text-slate-800 font-medium">
        {icon && <span className="text-slate-400">{icon}</span>}
        {value}
      </div>
    </div>
  )
}
