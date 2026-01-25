// apps/web/src/components/secretaria/AdmissoesRadarClient.tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, Plus } from 'lucide-react'

type AdmissaoStatus =
  | 'rascunho'
  | 'submetida'
  | 'em_analise'
  | 'aprovada'
  | 'rejeitada'
  | 'matriculado'

type RadarCounts = Partial<Record<AdmissaoStatus, number>> & {
  // opcional: se seu backend ainda manda chaves antigas, suportamos sem quebrar.
  NOVOS_ONLINE?: number
  EM_ANALISE?: number
  AGUARDANDO_PAGAMENTO?: number
  CONVERTIDOS?: number
}

type RadarItem = {
  id: string
  escola_id: string
  status: AdmissaoStatus
  status_raw?: string | null
  created_at: string
  updated_at?: string | null

  // se existir no seu select, perfeito. Se não existir, fica null.
  matriculado_em?: string | null

  nome_candidato?: string | null

  cursos?: { nome?: string | null } | null
  classes?: { nome?: string | null } | null
}

type RadarData = {
  counts?: RadarCounts
  items: RadarItem[]
  next_cursor_open?: string | null
  next_cursor_mat?: string | null
}

type UiColKey = 'submetida' | 'em_analise' | 'aprovada' | 'matriculado'

const COLS: Array<{
  key: UiColKey
  title: string
  status: AdmissaoStatus
  emptyText: string
}> = [
  { key: 'submetida', title: 'Submetidas', status: 'submetida', emptyText: 'Nenhuma candidatura submetida.' },
  { key: 'em_analise', title: 'Em Análise', status: 'em_analise', emptyText: 'Nada em análise.' },
  { key: 'aprovada', title: 'Aprovadas (Aguard. Pagamento)', status: 'aprovada', emptyText: 'Nenhuma aprovada.' },
  { key: 'matriculado', title: 'Matriculados (7 dias)', status: 'matriculado', emptyText: 'Nenhum matriculado recente.' },
]

function formatDateShort(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString()
}

function withinLastDays(iso: string, days: number) {
  const t = new Date(iso).getTime()
  const now = Date.now()
  const diff = now - t
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000
}

function pickCount(data: RadarData | null, status: AdmissaoStatus, fallback: number) {
  const counts = data?.counts
  if (!counts) return fallback

  // prioridade: contagem canônica por status
  const canonical = counts[status]
  if (typeof canonical === 'number') return canonical

  // compat: contagens legadas (seu backend ainda manda isso)
  if (status === 'em_analise' && typeof counts.EM_ANALISE === 'number') return counts.EM_ANALISE
  if (status === 'aprovada' && typeof counts.AGUARDANDO_PAGAMENTO === 'number') return counts.AGUARDANDO_PAGAMENTO
  if (status === 'matriculado' && typeof counts.CONVERTIDOS === 'number') return counts.CONVERTIDOS

  return fallback
}

export default function AdmissoesRadarClient({ escolaId }: { escolaId: string }) {
  const router = useRouter()

  const [data, setData] = useState<RadarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [nextCursorOpen, setNextCursorOpen] = useState<string | null>(null)
  const [nextCursorMat, setNextCursorMat] = useState<string | null>(null)
  const [loadingMoreOpen, setLoadingMoreOpen] = useState(false)
  const [loadingMoreMat, setLoadingMoreMat] = useState(false)

  const reload = useCallback(() => {
    window.location.reload()
  }, [])

  const approve = useCallback(
    async (item: RadarItem) => {
      const observacao = window.prompt("Observação (opcional):")?.trim() || undefined
      setActionLoadingId(item.id)
      try {
        const res = await fetch('/api/secretaria/admissoes/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidatura_id: item.id, observacao }),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.details || json?.error || 'Falha ao aprovar')
        reload()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Falha ao aprovar')
      } finally {
        setActionLoadingId(null)
      }
    },
    [reload]
  )

  const archive = useCallback(
    async (item: RadarItem) => {
      const motivo = window.prompt("Motivo (opcional):")?.trim() || undefined
      setActionLoadingId(item.id)
      try {
        const res = await fetch('/api/secretaria/admissoes/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidatura_id: item.id, motivo }),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao arquivar')
        reload()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Falha ao arquivar')
      } finally {
        setActionLoadingId(null)
      }
    },
    [reload]
  )

  const reject = useCallback(
    async (item: RadarItem) => {
      const motivo = window.prompt("Motivo da rejeição:")?.trim()
      if (!motivo) return
      setActionLoadingId(item.id)
      try {
        const res = await fetch('/api/secretaria/admissoes/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidatura_id: item.id, motivo }),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.details || json?.error || 'Falha ao rejeitar')
        reload()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Falha ao rejeitar')
      } finally {
        setActionLoadingId(null)
      }
    },
    [reload]
  )

  const fetchData = useCallback(
    async (options?: { cursorOpen?: string | null; cursorMat?: string | null; append?: boolean }) => {
      const ctrl = new AbortController()

      if (options?.append) {
        if (options.cursorOpen) setLoadingMoreOpen(true)
        if (options.cursorMat) setLoadingMoreMat(true)
      } else {
        setLoading(true)
      }

      setError(null)

      try {
        const params = new URLSearchParams({ escolaId })
        params.set('limit', '30')
        if (options?.cursorOpen) params.set('cursor_open', options.cursorOpen)
        if (options?.cursorMat) params.set('cursor_mat', options.cursorMat)

        const res = await fetch(`/api/secretaria/admissoes/radar?${params.toString()}`, {
          signal: ctrl.signal,
          headers: { Accept: 'application/json' },
        })

        if (!res.ok) {
          const body = await res.json().catch(() => null)
          const msg = body?.error ?? 'Falha ao carregar radar.'
          throw new Error(msg)
        }

        const json = (await res.json()) as RadarData
        setNextCursorOpen(json.next_cursor_open ?? null)
        setNextCursorMat(json.next_cursor_mat ?? null)
        if (options?.append) {
          setData((prev) => ({
            counts: prev?.counts ?? json.counts ?? {},
            items: [...(prev?.items ?? []), ...(json.items ?? [])],
          }))
        } else {
          setData({ counts: json.counts ?? {}, items: Array.isArray(json.items) ? json.items : [] })
        }
      } catch (e: unknown) {
        if (typeof e === 'object' && e && 'name' in e && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : 'Erro inesperado.')
      } finally {
        setLoading(false)
        setLoadingMoreOpen(false)
        setLoadingMoreMat(false)
      }

      return () => ctrl.abort()
    },
    [escolaId]
  )

  useEffect(() => {
    fetchData({ append: false })
  }, [fetchData])

  const columns = useMemo(() => {
    const items = data?.items ?? []

    const submitted = items.filter(i => i.status === 'submetida')
    const inReview = items.filter(i => i.status === 'em_analise')
    const approved = items.filter(i => i.status === 'aprovada')

    const matriculatedRecent = items
      .filter(i => i.status === 'matriculado')
      .filter(i => {
        const stamp = i.matriculado_em ?? i.updated_at ?? i.created_at
        return withinLastDays(stamp, 7)
      })

    const byStatus: Record<UiColKey, RadarItem[]> = {
      submetida: submitted,
      em_analise: inReview,
      aprovada: approved,
      matriculado: matriculatedRecent,
    }

    return byStatus
  }, [data])

  const loadMoreOpen = async () => {
    if (!nextCursorOpen || loadingMoreOpen) return
    await fetchData({ cursorOpen: nextCursorOpen, append: true })
  }

  const loadMoreMat = async () => {
    if (!nextCursorMat || loadingMoreMat) return
    await fetchData({ cursorMat: nextCursorMat, append: true })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 rounded-xl bg-slate-100" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="rounded-xl bg-slate-100 p-4">
              <div className="h-5 w-40 rounded bg-white/70" />
              <div className="mt-3 space-y-2">
                <div className="h-14 rounded-xl bg-white/70" />
                <div className="h-14 rounded-xl bg-white/70" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <div className="font-semibold">Erro ao carregar Radar</div>
        <div className="mt-1">{error}</div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 inline-flex items-center rounded-xl bg-red-600 px-3 py-2 text-white hover:brightness-95"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Radar de Admissões</h1>
          <p className="text-sm text-slate-500">Acompanhe o funil por status e priorize a secretaria.</p>
        </div>

        <button
          type="button"
          onClick={() => router.push('/secretaria/admissoes/nova')}
          className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-white hover:brightness-95"
        >
          <Plus className="h-4 w-4" />
          <span>Nova Admissão</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {COLS.map(col => {
          const items = columns[col.key] ?? []
          const count = pickCount(
            data,
            col.status,
            items.length // fallback honesto
          )

          return (
            <div key={col.key} className="rounded-xl bg-slate-950 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">{col.title}</h2>
                <span className="rounded-full bg-slate-900 px-2 py-1 text-xs text-klasse-gold ring-1 ring-klasse-gold/25">
                  {count}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {items.map(item => {
                  const nome = item.nome_candidato?.trim() || 'Sem nome'
                  const curso = item.cursos?.nome?.trim() || '—'
                  const classe = item.classes?.nome?.trim() || '—'
                  const dt = formatDateShort(item.created_at)
                  const busy = actionLoadingId === item.id
                  const rawStatus = (item.status_raw || '').toLowerCase()
                  const canArchive = ['submetida', 'em_analise', 'aprovada', 'aguardando_pagamento', 'aguardando_compensacao'].includes(rawStatus || item.status)

                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/secretaria/admissoes/nova?candidaturaId=${item.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          router.push(`/secretaria/admissoes/nova?candidaturaId=${item.id}`)
                        }
                      }}
                      className="w-full rounded-xl bg-slate-900 p-3 text-left ring-1 ring-white/5 hover:ring-klasse-gold/25"
                    >
                      <div className="text-sm font-semibold text-white">{nome}</div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {curso} • {classe}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">{dt}</div>
                      {rawStatus === 'aguardando_pagamento' && (
                        <div className="mt-1 text-[11px] text-amber-300">Aguardando pagamento</div>
                      )}
                      {item.status !== 'matriculado' && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(item.status === 'submetida' || item.status === 'em_analise') && (
                            <>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                void approve(item)
                              }}
                                disabled={busy}
                                className="rounded-lg bg-klasse-gold px-2.5 py-1 text-[11px] font-semibold text-white hover:brightness-95 disabled:opacity-60"
                              >
                                Aprovar
                              </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                void reject(item)
                              }}
                                disabled={busy}
                                className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:border-red-400 hover:text-red-300 disabled:opacity-60"
                              >
                                Rejeitar
                              </button>
                            </>
                          )}
                          {item.status === 'aprovada' && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                router.push(`/secretaria/admissoes/nova?candidaturaId=${item.id}`)
                              }}
                              className="rounded-lg bg-klasse-green px-2.5 py-1 text-[11px] font-semibold text-white hover:brightness-95"
                            >
                              Matricular
                            </button>
                          )}
                          {canArchive && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                void archive(item)
                              }}
                              disabled={busy}
                              className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:border-slate-500 hover:text-slate-100 disabled:opacity-60"
                            >
                              <span className="inline-flex items-center gap-1">
                                <Archive className="h-3 w-3" />
                                Arquivar
                              </span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {items.length === 0 && (
                  <div className="rounded-xl bg-slate-900 p-3 text-xs text-slate-400 ring-1 ring-white/5">
                    {col.emptyText}
                  </div>
                )}
              </div>
              {col.key !== 'matriculado' && nextCursorOpen && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    void loadMoreOpen()
                  }}
                  disabled={loadingMoreOpen}
                  className="mt-3 w-full rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-klasse-gold/40 hover:text-white disabled:opacity-60"
                >
                  {loadingMoreOpen ? 'Carregando...' : 'Carregar mais'}
                </button>
              )}
              {col.key === 'matriculado' && nextCursorMat && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    void loadMoreMat()
                  }}
                  disabled={loadingMoreMat}
                  className="mt-3 w-full rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-klasse-gold/40 hover:text-white disabled:opacity-60"
                >
                  {loadingMoreMat ? 'Carregando...' : 'Carregar mais'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
