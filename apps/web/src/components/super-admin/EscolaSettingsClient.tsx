"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { PLAN_NAMES, type PlanTier } from "@/config/plans"

type Props = {
  escolaId: string
  initialAlunoPortalEnabled: boolean
  initialPlano: PlanTier
}

export default function EscolaSettingsClient({ escolaId, initialAlunoPortalEnabled, initialPlano }: Props) {
  const [alunoPortalEnabled, setAlunoPortalEnabled] = useState(initialAlunoPortalEnabled)
  const [plano, setPlano] = useState<PlanTier>(initialPlano)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  return (
    <section className="rounded-xl border border-border bg-card p-4 text-foreground shadow-sm">
      <h2 className="text-lg font-semibold mb-3">Plano e Recursos</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="escola-plano" className="mb-1 block text-sm font-medium text-foreground">Plano</label>
          <select id="escola-plano" value={plano} onChange={(e)=>setPlano(e.target.value as PlanTier)} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-klasse-gold focus:outline-none focus:ring-4 focus:ring-klasse-gold/20">
            <option value="essencial">{PLAN_NAMES.essencial} (Financeiro Essencial)</option>
            <option value="profissional">{PLAN_NAMES.profissional} (Financeiro Avançado)</option>
            <option value="premium">{PLAN_NAMES.premium} (Financeiro + Fiscal)</option>
          </select>
          <p className="text-xs text-muted-foreground mt-2">
            - Essencial: cobranças internas, registros manuais, relatórios simples, despesas manuais.
            <br/>
            - Profissional: + boletos/links, relatórios detalhados, alertas automáticos, exportações.
            <br/>
            - Premium: + módulo fiscal, integração contábil, dashboards avançados, multiunidades.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input id="aluno_portal" type="checkbox" className="h-4 w-4 accent-klasse-gold" checked={alunoPortalEnabled} onChange={(e)=>setAlunoPortalEnabled(e.target.checked)} />
          <label htmlFor="aluno_portal" className="text-sm">Habilitar Portal do Aluno</label>
        </div>
      </div>
      <div className="mt-4">
        <Button disabled={saving} onClick={async ()=>{
          setSaving(true); setMsg('')
          try {
            const res = await fetch(`/api/super-admin/escolas/${escolaId}/update`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aluno_portal_enabled: alunoPortalEnabled, plano }) })
            const data = await res.json(); if (!res.ok) throw new Error(data?.error || 'Falha ao salvar')
            setMsg('Configurações salvas com sucesso.')
          } catch (e: any) { setMsg(e?.message || 'Erro ao salvar') } finally { setSaving(false) }
        }} tone="blue">{saving ? 'Salvando...' : 'Salvar alterações'}</Button>
        {msg && <span className="ml-3 text-sm text-muted-foreground">{msg}</span>}
      </div>
    </section>
  )
}
