// /components/escola/OnboardingStep3.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { OnboardingData } from "@/types/onboarding"
import { createClient } from "@/lib/supabaseClient"

type Props = {
  onBack: () => void
  onFinish: () => void
  data: OnboardingData
  updateData: (data: Partial<OnboardingData>) => void
  loading?: boolean
  escolaId: string
}

export default function OnboardingStep3({ onBack, onFinish, data, updateData, loading, escolaId }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [plano, setPlano] = useState<'basico'|'standard'|'premium'>('basico')
  const [alunoPortalEnabled, setAlunoPortalEnabled] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)

  useEffect(() => {
    let mounted = true
    const bootstrap = async () => {
      const { data: sess } = await supabase.auth.getUser()
      const user = sess?.user
      if (!mounted || !user) return
      const { data: prof } = await supabase.from('profiles').select('role').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1)
      const role = (prof?.[0] as any)?.role as string | undefined
      if (!mounted) return
      setIsSuperAdmin(role === 'super_admin')
      const { data: esc } = await supabase.from('escolas').select('plano, aluno_portal_enabled').eq('id', escolaId).maybeSingle()
      if (!mounted) return
      const planVal = ((esc as any)?.plano || 'basico') as 'basico'|'standard'|'premium'
      setPlano(planVal)
      setAlunoPortalEnabled(Boolean((esc as any)?.aluno_portal_enabled))
    }
    bootstrap()
    return () => { mounted = false }
  }, [supabase, escolaId])

  const savePlan = async () => {
    try {
      setSavingPlan(true)
      const body: { plano: 'basico'|'standard'|'premium'; aluno_portal_enabled: boolean } = {
        plano,
        aluno_portal_enabled: (plano === 'standard' || plano === 'premium') ? alunoPortalEnabled : false,
      }
      const res = await fetch(`/api/super-admin/escolas/${escolaId}/update`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Falha ao salvar plano')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSavingPlan(false)
    }
  }
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onFinish()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-2xl font-bold mb-2">👩‍🏫 Equipe Inicial</h2>
      <p className="text-sm text-gray-500 mb-6">
        Convide professores e equipe administrativa para começar a usar o sistema.
      </p>

      <div>
        <label className="block text-sm font-medium mb-1">E-mail do Professor</label>
        <input
          type="email"
          value={data.teacherEmail}
          onChange={(e) => updateData({ teacherEmail: e.target.value })}
          placeholder="professor@escola.com"
          className="w-full border px-4 py-2 rounded-lg focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">E-mail da Secretária</label>
        <input
          type="email"
          value={data.staffEmail}
          onChange={(e) => updateData({ staffEmail: e.target.value })}
          placeholder="secretaria@escola.com"
          className="w-full border px-4 py-2 rounded-lg focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
        />
      </div>

      {isSuperAdmin && (
        <div className="bg-gray-50 border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-2">Plano e Portal do Aluno (Super Admin)</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Plano</label>
            <select value={plano} onChange={(e)=>setPlano(e.target.value as 'basico'|'standard'|'premium')} className="border rounded px-3 py-2 w-full text-sm">
                <option value="basico">Básico</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">Altera recursos liberados para a escola.</p>
            </div>
            <div className="flex items-center gap-2">
              <input id="onb_aluno_portal" type="checkbox" className="h-4 w-4" disabled={plano==='basico'} checked={alunoPortalEnabled} onChange={(e)=>setAlunoPortalEnabled(e.target.checked)} />
              <label htmlFor="onb_aluno_portal" className="text-sm">Habilitar Portal do Aluno {plano==='basico' && <span className="text-gray-400">(Standard/Premium)</span>}</label>
            </div>
          </div>
          <div className="mt-3">
            <button type="button" disabled={savingPlan} onClick={savePlan} className="px-3 py-2 text-xs bg-blue-600 text-white rounded disabled:opacity-50">
              {savingPlan ? 'Salvando…' : 'Salvar plano' }
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 rounded-lg border hover:bg-gray-100"
        >
          Voltar
        </button>
        <button
          type="submit"
          disabled={!!loading}
          className={`px-6 py-3 rounded-lg text-white ${loading ? "bg-teal-400 cursor-not-allowed" : "bg-moxinexa-teal hover:bg-teal-600"}`}
        >
          {loading ? "Finalizando…" : "Finalizar"}
        </button>
      </div>
    </form>
  )
}
