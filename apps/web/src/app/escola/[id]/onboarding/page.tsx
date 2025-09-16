// /escola/[id]/onboarding/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabaseClient"

import OnboardingStep1 from "@/components/escola/OnboardingStep1"
import OnboardingStep2 from "@/components/escola/OnboardingStep2"
import OnboardingStep3 from "@/components/escola/OnboardingStep3"

import { OnboardingData } from "@/types/onboarding"

export default function Page() {
  const { id } = useParams<{ id: string }>() // ✅ pega o id da rota
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    schoolName: "",
    primaryColor: "#3b82f6",
    logo: null,
    className: "",
    subjects: "",
    teacherEmail: "",
    staffEmail: ""
  })

  const nextStep = () => setStep((s) => s + 1)
  const prevStep = () => setStep((s) => s - 1)

  const updateOnboardingData = (newData: Partial<OnboardingData>) => {
    setOnboardingData(prev => ({ ...prev, ...newData }))
  }

  const finishOnboarding = async () => {
    try {
      if (!id) throw new Error("ID da escola ausente")

      // 1) Atualiza dados básicos da escola
      const { error: schoolError } = await supabase
        .from("escolas")
        .update({
          nome: onboardingData.schoolName,
          cor_primaria: onboardingData.primaryColor,
          onboarding_finalizado: true
        })
        .eq("id", id)

      if (schoolError) throw schoolError

      // 2) Cria turma (se informada)
      if (onboardingData.className?.trim()) {
        const { error: classError } = await supabase
          .from("turmas")
          .insert([{ nome: onboardingData.className.trim(), escola_id: id }])

        if (classError) throw classError
      }

   // 3) Criar disciplinas (se informadas)
if (onboardingData.subjects?.trim()) {
  const subjectsArray = onboardingData.subjects
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)

  if (subjectsArray.length) {
    const { error: subjectsError } = await supabase
      .from("disciplinas") // ❌ aqui quebra se a tabela não existe
      .insert(subjectsArray.map(nome => ({ nome, escola_id: id })))

    if (subjectsError) throw subjectsError
  }
}


      // 4) “Envio” de convites (simulação por enquanto)
      if (onboardingData.teacherEmail) {
        console.log("Enviando convite para professor:", onboardingData.teacherEmail)
      }
      if (onboardingData.staffEmail) {
        console.log("Enviando convite para equipe:", onboardingData.staffEmail)
      }

      router.push(`/escola/${id}/dashboard`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error("❌ Erro detalhado no finishOnboarding:", error)
      alert(message ? `Erro: ${message}` : "Erro desconhecido ao finalizar a configuração.")
    }
  } // ⬅️ ESTA CHAVE FALTAVA

  // Carrega nome da escola (se já existir)
  useEffect(() => {
    const fetchSchoolName = async () => {
      if (!id) return
      const { data, error } = await supabase
        .from("escolas")
        .select("nome")
        .eq("id", id)
        .single()

      if (!error && data) {
        setOnboardingData(prev => ({ ...prev, schoolName: data.nome || "" }))
      }
    }

    fetchSchoolName()
  }, [id, supabase])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl bg-white shadow-lg rounded-2xl p-8 space-y-6">
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
          />
        )}
      </div>
    </div>
  )
}
