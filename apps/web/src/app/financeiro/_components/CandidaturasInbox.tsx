"use client"

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckCircle2, XCircle, Paperclip, Loader2 } from 'lucide-react'

type InboxItem = {
  id: string
  nome: string
  cursoNome: string
  status: string | null
  turmaPreferencialId: string | null
  pagamento: { metodo?: string | null; referencia?: string | null; comprovativo_url?: string | null }
  created_at: string | null
}

export function FinanceiroCandidaturasInbox({ escolaId, initialItems }: { escolaId: string; initialItems: InboxItem[] }) {
  const [items, setItems] = useState<InboxItem[]>(initialItems || [])
  const [selected, setSelected] = useState<InboxItem | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id))

  const handleConfirm = async (item: InboxItem) => {
    if (!item.turmaPreferencialId) {
      setError('Selecione/defina uma turma preferencial antes de confirmar.')
      return
    }
    setLoadingId(item.id)
    setError(null)
    try {
      const res = await fetch(`/api/secretaria/candidaturas/${item.id}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turma_id: item.turmaPreferencialId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao confirmar')
      removeItem(item.id)
      setSelected(null)
    } catch (e: any) {
      setError(e?.message || 'Erro ao confirmar')
    } finally {
      setLoadingId(null)
    }
  }

  const handleReject = async (item: InboxItem) => {
    const motivo = prompt('Informe o motivo da rejeição (opcional):') || undefined
    setLoadingId(item.id)
    setError(null)
    try {
      const res = await fetch('/api/financeiro/candidaturas/rejeitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, motivo }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao rejeitar')
      removeItem(item.id)
      setSelected(null)
    } catch (e: any) {
      setError(e?.message || 'Erro ao rejeitar')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="grid lg:grid-cols-[2fr,1fr] gap-6">
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-500">
            Nenhuma candidatura aguardando compensação.
          </div>
        ) : (
          items.map((item) => {
            const pagamento = item.pagamento || {}
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-4 p-4 rounded-lg border ${
                  selected?.id === item.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'
                }`}
              >
                <div className="space-y-1">
                  <div className="font-semibold text-gray-900">{item.nome}</div>
                  <div className="text-sm text-gray-600">{item.cursoNome}</div>
                  <div className="text-xs text-gray-500">
                    {item.created_at ? format(new Date(item.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR }) : ''}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <span>Método: {pagamento.metodo || 'N/D'}</span>
                    {pagamento.referencia ? <span className="text-gray-400">• Ref: {pagamento.referencia}</span> : null}
                  </div>
                  {pagamento.comprovativo_url ? (
                    <button
                      onClick={() => setSelected(item)}
                      className="inline-flex items-center gap-1 text-emerald-700 text-sm hover:underline"
                    >
                      <Paperclip className="w-4 h-4" /> Ver comprovativo
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleConfirm(item)}
                    disabled={loadingId === item.id}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-60"
                  >
                    {loadingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Compensar
                  </button>
                  <button
                    onClick={() => handleReject(item)}
                    disabled={loadingId === item.id}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm hover:bg-red-100 disabled:opacity-60"
                  >
                    <XCircle className="w-4 h-4" /> Rejeitar
                  </button>
                </div>
              </div>
            )
          })
        )}
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
      </div>

      {selected ? (
        <div className="rounded-lg border border-gray-200 p-4 bg-white shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-sm text-gray-500">Validar Pagamento</div>
              <div className="font-semibold text-gray-900">{selected.nome}</div>
              <div className="text-sm text-gray-600">{selected.cursoNome}</div>
            </div>
            <button className="text-sm text-gray-500 hover:text-gray-800" onClick={() => setSelected(null)}>
              Fechar
            </button>
          </div>

          <div className="space-y-3">
            {selected.pagamento?.comprovativo_url ? (
              <div className="bg-gray-50 rounded-lg p-3">
                <a
                  href={selected.pagamento.comprovativo_url as string}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-emerald-700 hover:underline flex items-center gap-2"
                >
                  <Paperclip className="w-4 h-4" /> Ver comprovativo
                </a>
              </div>
            ) : null}

            <div className="text-sm text-gray-700">
              <div><strong>Método:</strong> {selected.pagamento?.metodo || 'N/D'}</div>
              {selected.pagamento?.referencia ? <div><strong>Ref:</strong> {selected.pagamento?.referencia}</div> : null}
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 rounded-lg">
              ⚠️ Confirme no extrato bancário antes de compensar.
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleConfirm(selected)}
                disabled={loadingId === selected.id}
                className="flex-1 inline-flex justify-center items-center gap-2 px-3 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-60"
              >
                {loadingId === selected.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirmar e gerar matrícula
              </button>
              <button
                onClick={() => handleReject(selected)}
                disabled={loadingId === selected.id}
                className="flex-1 inline-flex justify-center items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm hover:bg-red-100 disabled:opacity-60"
              >
                <XCircle className="w-4 h-4" /> Rejeitar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500 bg-gray-50">
          Selecione uma candidatura para ver o comprovativo e confirmar.
        </div>
      )}
    </div>
  )
}
