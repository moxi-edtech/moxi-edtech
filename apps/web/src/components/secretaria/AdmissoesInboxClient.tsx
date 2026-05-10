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
  Calendar
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useEscolaId } from '@/hooks/useEscolaId'
import { useToast, useConfirm } from '@/components/feedback/FeedbackSystem'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

type AdmissaoStatus =
  | 'rascunho'
  | 'submetida'
  | 'em_analise'
  | 'aprovada'
  | 'rejeitada'
  | 'matriculado'
  | 'pendente'

type CandidaturaListItem = {
  id: string
  escola_id: string
  status: AdmissaoStatus
  created_at: string
  updated_at?: string | null
  nome_candidato: string
  cursos?: { nome: string } | null
  classes?: { nome: string } | null
}

type CandidaturaDetail = CandidaturaListItem & {
  dados_candidato: {
    telefone?: string
    bi_numero?: string
    tipo_documento?: string
    numero_documento?: string
    email?: string
    data_nascimento?: string
    sexo?: string
    nif?: string
    endereco?: string
    naturalidade?: string
    provincia?: string
    encarregado_relacao?: string
    responsavel_nome?: string
    responsavel_contato?: string
    encarregado_email?: string
    responsavel_financeiro_nome?: string
    responsavel_financeiro_nif?: string
    mesmo_que_encarregado?: boolean
    documentos?: Record<string, string>
  }
  source?: string
  ano_letivo?: number
}

const STATUS_CONFIG: Record<AdmissaoStatus, { label: string; color: string; bg: string }> = {
  rascunho: { label: 'Rascunho', color: 'text-slate-500', bg: 'bg-slate-100' },
  submetida: { label: 'Nova', color: 'text-blue-600', bg: 'bg-blue-50' },
  pendente: { label: 'Nova', color: 'text-blue-600', bg: 'bg-blue-50' },
  em_analise: { label: 'Em Análise', color: 'text-amber-600', bg: 'bg-amber-50' },
  aprovada: { label: 'Aprovada', color: 'text-klasse-green', bg: 'bg-klasse-green/10' },
  rejeitada: { label: 'Rejeitada', color: 'text-red-600', bg: 'bg-red-50' },
  matriculado: { label: 'Matriculado', color: 'text-klasse-green', bg: 'bg-klasse-green/20' },
}

async function fetchAdmissoes(url: string): Promise<CandidaturaListItem[]> {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || 'Falha ao carregar admissões')
  return json.items || []
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
  const [statusFilter, setStatusFilter] = useState<'novas' | 'pendentes' | 'concluidas'>('novas')

  
  const [viewingDoc, setViewingDoc] = useState<{ name: string; url: string } | null>(null)

  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const listUrl = useMemo(() => {
    const params = new URLSearchParams({ escolaId, limit: '100' })
    if (turmaId) params.set('turmaId', turmaId)
    return `/api/secretaria/admissoes/radar?${params.toString()}`
  }, [escolaId, turmaId])

  const {
    data: itemsData,
    isLoading,
    error: swrError,
    mutate,
  } = useSWR<CandidaturaListItem[]>(listUrl, fetchAdmissoes, {
    fallbackData: initialItems,
    keepPreviousData: true,
  })

  const items = itemsData || []
  const loading = isLoading && items.length === 0
  const listError = swrError instanceof Error ? swrError.message : null

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
    } catch (err: any) {
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

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.nome_candidato.toLowerCase().includes(search.toLowerCase())
      
      let matchesStatus = false
      if (statusFilter === 'novas') {
        matchesStatus = item.status === 'submetida' || item.status === 'pendente'
      } else if (statusFilter === 'pendentes') {
        matchesStatus = item.status === 'em_analise' || item.status === 'aprovada' || item.status === 'rascunho'
      } else if (statusFilter === 'concluidas') {
        matchesStatus = item.status === 'matriculado' || item.status === 'rejeitada'
      }
      
      return matchesSearch && matchesStatus
    })
  }, [items, search, statusFilter])

  const handleApprove = async () => {
    if (!selectedId) return
    router.push(withSlug(`/secretaria/admissoes/nova?candidaturaId=${selectedId}`))
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
        (prev) => (prev || []).map((item) => (item.id === selectedId ? { ...item, status: 'rejeitada' } : item)),
        false
      )
      if (selectedData) setSelectedData({ ...selectedData, status: 'rejeitada' })
      success('Candidatura rejeitada', 'A candidatura foi marcada como rejeitada. O registo permanecerá no sistema para consulta futura.')
    } catch (err: any) {
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
    } catch (err: any) {
      toastError('Falha ao arquivar', 'Houve um erro técnico ao tentar arquivar este registo. Por favor, tente novamente.')
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

  const getDocUrl = (path: string) => {
    // Assuming the base URL for Supabase storage
    // You might need to adjust this based on your environment
    const publicUrl = `https://wjtifcpxxxotsbmvbgoq.supabase.co/storage/v1/object/public/candidaturas/${path}`
    return publicUrl
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
                className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-500"
                title="Copiar Link"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button 
                onClick={handleShareWhatsApp}
                className="p-1.5 hover:bg-[#25D366]/10 rounded-lg transition-colors text-[#25D366]"
                title="Partilhar no WhatsApp"
              >
                <MessageCircle className="h-3.5 w-3.5 fill-[#25D366]/10" />
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

          <div className="flex p-1 bg-slate-100 rounded-xl">
            {(['novas', 'pendentes', 'concluidas'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  statusFilter === f 
                    ? 'bg-white text-klasse-green shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
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
                      {item.classes?.nome || '—'} • {item.cursos?.nome || '—'}
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
                          <Badge variant="outline" className="font-mono text-[10px] uppercase">
                            ID: {selectedData.id.slice(0, 8)}
                          </Badge>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_CONFIG[selectedData.status]?.bg || 'bg-slate-100'} ${STATUS_CONFIG[selectedData.status]?.color || 'text-slate-500'}`}>
                            {STATUS_CONFIG[selectedData.status]?.label || selectedData.status}
                          </span>
                        </div>
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
                            onClick={() => openWhatsApp(selectedData.dados_candidato.responsavel_contato)}
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
                          onClick={() => router.push(withSlug(`/secretaria/admissoes/nova?candidaturaId=${selectedId}`))}
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
                        </div>
                      </section>

                      {/* Documentos */}
                      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Documentos Anexados
                        </h3>
                        <div className="flex flex-wrap gap-4">
                          {selectedData.dados_candidato?.documentos && Object.entries(selectedData.dados_candidato.documentos).length > 0 ? (
                            Object.entries(selectedData.dados_candidato.documentos).map(([name, path]) => (
                              <div 
                                key={name}
                                onClick={() => setViewingDoc({ name, url: getDocUrl(path) })}
                                className="group relative w-24 h-32 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden cursor-pointer hover:border-klasse-gold transition-all"
                              >
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <FileText className="h-8 w-8 text-slate-300" />
                                </div>
                                <div className="absolute bottom-0 inset-x-0 p-2 bg-white/90 text-[8px] font-bold text-center truncate uppercase">
                                  {name.replace('_', ' ')}
                                </div>
                                <div className="absolute inset-0 bg-klasse-green/0 group-hover:bg-klasse-green/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                  <ExternalLink className="h-5 w-5 text-klasse-green" />
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="flex flex-col items-center justify-center w-full py-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                              <FileText className="h-8 w-8 mb-2 opacity-50" />
                              <p className="text-xs">Nenhum documento anexado</p>
                            </div>
                          )}
                        </div>
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
                    
                    {['submetida', 'em_analise', 'pendente'].includes(selectedData.status) && (
                      <button 
                        onClick={handleApprove}
                        disabled={!!loadingAction}
                        className="flex items-center gap-3 px-10 py-4 bg-[#E3B23C] text-white rounded-2xl font-bold shadow-xl shadow-klasse-gold/20 hover:shadow-2xl hover:brightness-105 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Check className="h-5 w-5" />
                        Continuar Matrícula
                      </button>
                    )}

                    {selectedData.status === 'aprovada' && (
                      <button 
                        onClick={() => router.push(withSlug(`/secretaria/admissoes/nova?candidaturaId=${selectedId}`))}
                        className="flex items-center gap-3 px-10 py-4 bg-klasse-green text-white rounded-2xl font-bold shadow-xl shadow-klasse-green/20 hover:shadow-2xl hover:brightness-105 hover:scale-[1.02] transition-all active:scale-95"
                      >
                        <Check className="h-5 w-5" />
                        Finalizar Matrícula
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
