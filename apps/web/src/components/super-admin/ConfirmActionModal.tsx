"use client"

import { useState } from "react"
import { toast } from "react-hot-toast"

type Props = {
  action: 'suspend' | 'reactivate' | 'delete'
  escolaId: string | number
  escolaNome: string
  onClose: () => void
  onChanged: (newStatus?: 'suspensa'|'ativa'|'deleted', mode?: 'soft'|'hard') => void
}

export default function ConfirmActionModal({ action, escolaId, escolaNome, onClose, onChanged }: Props) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirmar ação</h3>
        <p className="text-sm text-gray-600">
          {action === 'suspend' && (
            <>Deseja realmente suspender a escola <strong>{escolaNome}</strong>? Usuários perderão o acesso até reativação.</>
          )}
          {action === 'reactivate' && (
            <>Deseja reativar a escola <strong>{escolaNome}</strong>? O acesso será restabelecido.</>
          )}
          {action === 'delete' && (
            <>
              <span className="text-red-600 font-semibold">Atenção:</span> Esta ação elimina a escola <strong>{escolaNome}</strong>.
              Dependendo de vínculos existentes, pode ser aplicada exclusão definitiva ou marcação como excluída.
            </>
          )}
        </p>
        {action === 'suspend' && (
          <div className="mt-4">
            <label className="block text-sm text-gray-700 mb-1">Motivo (opcional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Inadimplência, auditoria em andamento, solicitação da escola, etc."
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button
            disabled={busy}
            onClick={async () => {
              try {
                setBusy(true)
                if (action === 'delete') {
                  const res = await fetch(`/api/super-admin/escolas/${escolaId}/delete`, { method: 'DELETE' })
                  const json = await res.json()
                  if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao eliminar escola')
                  onChanged('deleted', json.mode)
                  toast.success(json.mode === 'soft' ? 'Escola marcada como excluída' : 'Escola eliminada')
                  onClose()
                  return
                }
                const path = action === 'suspend' ? 'suspend' : 'reactivate'
                const init: RequestInit = action === 'suspend'
                  ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo: reason || undefined }) }
                  : { method: 'POST' }
                const res = await fetch(`/api/super-admin/escolas/${escolaId}/${path}`, init)
                const json = await res.json()
                if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha na operação')
                if (action === 'suspend') {
                  onChanged('suspensa')
                  toast.success('Escola suspensa')
                } else {
                  onChanged('ativa')
                  toast.success('Escola reativada')
                }
                onClose()
              } catch (e) {
                const m = e instanceof Error ? e.message : String(e)
                toast.error(`Erro: ${m}`)
              } finally {
                setBusy(false)
              }
            }}
            className={`px-3 py-2 text-sm rounded-md text-white ${action === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50`}
          >Confirmar</button>
        </div>
      </div>
    </div>
  )
}

