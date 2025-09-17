// /escola/[id]/onboarding/page.tsx
"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabaseClient"
import type { TablesInsert, TablesUpdate } from "~types/supabase"
import toast, { Toaster } from "react-hot-toast"

import OnboardingStep1 from "@/components/escola/OnboardingStep1"
import OnboardingStep2 from "@/components/escola/OnboardingStep2"
import OnboardingStep3 from "@/components/escola/OnboardingStep3"

import { OnboardingData } from "@/types/onboarding"

export default function Page() {
  const params = useParams<{ id: string | string[] }>() // pega o id da rota
  const id = Array.isArray(params.id) ? params.id[0] : params.id
  const router = useRouter()
  // memoiza o client para estabilidade de referência entre renders
  const supabase = useMemo(() => createClient(), [])

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    schoolName: "",
    primaryColor: "#3b82f6",
    logo: null,
    className: "",
    subjects: "",
    teacherEmail: "",
    staffEmail: ""
  })

  const nextStep = () => setStep((s) => Math.min(3, s + 1))
  const prevStep = () => setStep((s) => Math.max(1, s - 1))

  const updateOnboardingData = (newData: Partial<OnboardingData>) => {
    setOnboardingData(prev => ({ ...prev, ...newData }))
  }

  const finishOnboarding = async () => {
    if (!id) {
      toast.error("ID da escola ausente")
      return
    }

    setLoading(true)
    try {
      const escolaId = id as string

      // 1) Atualiza dados básicos da escola
      const escolaUpdate = {
        nome: onboardingData.schoolName,
        cor_primaria: onboardingData.primaryColor,
        onboarding_finalizado: true,
      } satisfies TablesUpdate<"escolas">

      const { error: schoolError } = await supabase
        .from("escolas")
        .update(escolaUpdate)
        .eq("id", escolaId)

      if (schoolError) throw new Error(schoolError.message || "Falha ao atualizar escola")

      // 2) Cria turma (se informada)
      if (onboardingData.className?.trim()) {
        const turmasInsert = [
          { nome: onboardingData.className.trim(), escola_id: escolaId },
        ] satisfies TablesInsert<"turmas">[]

        const { error: classError } = await supabase
          .from("turmas")
          .insert(turmasInsert)

        if (classError) throw new Error(classError.message || "Falha ao criar turma")
      }

      // 3) Criar disciplinas (se informadas)
      if (onboardingData.subjects?.trim()) {
        const subjectsArray = onboardingData.subjects
          .split(",")
          .map(s => s.trim())
          .filter(Boolean)

        if (subjectsArray.length) {
          const disciplinasInsert = subjectsArray.map((disciplinaNome) => ({
            nome: disciplinaNome,
            escola_id: escolaId,
          })) satisfies TablesInsert<"disciplinas">[]

          const { error: subjectsError } = await supabase
            .from("disciplinas")
            .insert(disciplinasInsert)

          // Em ambientes onde a tabela não exista, apenas loga e segue o fluxo
          if (subjectsError) {
            console.warn("⚠️ Falha ao criar disciplinas (continuando onboarding):", subjectsError)
          }
        }
      }


      // 4) “Envio” de convites (simulação por enquanto)
      if (onboardingData.teacherEmail) {
        console.log("Enviando convite para professor:", onboardingData.teacherEmail)
      }
      if (onboardingData.staffEmail) {
        console.log("Enviando convite para equipe:", onboardingData.staffEmail)
      }

      toast.success("Onboarding concluído com sucesso! 🚀")
      router.push(`/escola/${escolaId}/dashboard`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error("❌ Erro detalhado no finishOnboarding:", error)
      toast.error(message || "Erro desconhecido ao finalizar a configuração.")
    } finally {
      setLoading(false)
    }
  } // ⬅️ ESTA CHAVE FALTAVA

  // Carrega nome da escola (se já existir)
  useEffect(() => {
    const fetchSchoolName = async () => {
      if (!id) return
      const escolaId = id as string
      const { data, error } = await supabase
        .from("escolas")
        .select("nome")
        .eq("id", escolaId)
        .single<{ nome: string | null }>()

      if (!error && data) {
        setOnboardingData(prev => ({ ...prev, schoolName: (data?.nome ?? "") }))
      }
    }

    fetchSchoolName()
  }, [id, supabase])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl bg-white shadow-lg rounded-2xl p-8 space-y-6">
        <Toaster />
        {/* Indicador de progresso */}
        <div className="flex justify-center mb-6">
          <div className="flex space-x-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${i === step ? "bg-moxinexa-teal" : "bg-gray-300"}`}
              />
            ))}
          </div>
        </div>

        {/* Steps */}
        {step === 1 && (
          <OnboardingStep1
            onNext={nextStep}
            data={onboardingData}
            updateData={updateOnboardingData}
          />
        )}
        {step === 2 && (
          <OnboardingStep2
            onNext={nextStep}
            onBack={prevStep}
            data={onboardingData}
            updateData={updateOnboardingData}
          />
        )}
        {step === 3 && (
          <OnboardingStep3
            onBack={prevStep}
            onFinish={finishOnboarding}
            data={onboardingData}
            updateData={updateOnboardingData}
            loading={loading}
          />
        )}
      </div>
    </div>
  )
}
