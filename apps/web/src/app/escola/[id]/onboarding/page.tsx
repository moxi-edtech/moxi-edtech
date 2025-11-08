"use client"

import { useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import OnboardingStep1 from "@/components/escola/OnboardingStep1"
import OnboardingStep2 from "@/components/escola/OnboardingStep2"
import OnboardingStep3 from "@/components/escola/OnboardingStep3"
import { OnboardingData } from "@/types/onboarding"

export default function OnboardingPage() {
  // Normaliza o id vindo dos params para string, evitando warnings de tipo
  const p = useParams() as Record<string, string | string[] | undefined>
  const escolaId = Array.isArray(p.id) ? p.id[0] : (p.id ?? '')
  const router = useRouter()
  const search = useSearchParams()
  const stepParam = search.get('step')
  const step = useMemo(() => {
    const n = Number(stepParam)
    return (n === 2 || n === 3) ? n : 1
  }, [stepParam])

  const [data, setData] = useState<OnboardingData>({
    schoolName: "",
    primaryColor: "#0B2C45",
    logo: null,
    logoUrl: undefined,
    className: "",
    subjects: "",
    teacherEmail: "",
    staffEmail: "",
  })
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)

  const updateData = (partial: Partial<OnboardingData>) => setData(prev => ({ ...prev, ...partial }))

  const goToStep = (n: number) => {
    const url = new URL(window.location.href)
    url.searchParams.set('step', String(n))
    router.push(`${url.pathname}?${url.searchParams.toString()}`)
  }

  const finish = async () => {
    try {
      setFinishError(null)
      setFinishing(true)
      const res = await fetch(`/api/escolas/${escolaId}/onboarding`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherEmail: data.teacherEmail, staffEmail: data.staffEmail }) })
      const json = await res.json()
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Falha ao finalizar onboarding')
      }
      const next = (json?.nextPath as string) || `/escola/${escolaId}/admin/dashboard`
      router.replace(next)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido'
      setFinishError(msg)
    } finally {
      setFinishing(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-200">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-3xl">
        {step === 1 && <OnboardingStep1 />}
        {step === 2 && <OnboardingStep2 />}
        {step === 3 && (
          <div>
            <h1 className="text-2xl font-bold text-[#0B2C45] mb-4">Configuração Acadêmica - Etapa 3/3</h1>
            <OnboardingStep3
              escolaId={escolaId}
              data={data}
              updateData={updateData}
              onBack={() => goToStep(2)}
              onFinish={finish}
              loading={finishing}
            />
            {finishError && (
              <p className="text-sm text-red-600 mt-4">{finishError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
