"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { toast } from "react-hot-toast"

type Props = {
  escolaId: string | number
  onClose: () => void
}

export default function SchoolBillingModal({ escolaId, onClose }: Props) {
  const [valor, setValor] = useState("")
  const [vencimento, setVencimento] = useState("")
  const [sending, setSending] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Enviar cobrança</h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Valor (R$)"
            value={valor}
            onChange={(e)=>setValor(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <input
            type="date"
            value={vencimento}
            onChange={(e)=>setVencimento(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button onClick={onClose} variant="outline" tone="gray" size="sm">Cancelar</Button>
          <Button
            disabled={sending}
            onClick={async ()=>{
              try {
                setSending(true)
                const res = await fetch(`/api/super-admin/escolas/${escolaId}/billing-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ valor, vencimento }) })
                const json = await res.json()
                if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao enviar cobrança')
                toast.success('Cobrança enviada')
                onClose()
              } catch (e) {
                const m = e instanceof Error ? e.message : String(e)
                toast.error(`Erro: ${m}`)
              } finally {
                setSending(false)
              }
            }}
            tone="blue"
            size="sm"
          >Enviar</Button>
        </div>
      </div>
    </div>
  )
}
