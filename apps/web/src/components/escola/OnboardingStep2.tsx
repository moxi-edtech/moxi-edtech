// /components/escola/OnboardingStep2.tsx
"use client"

import { OnboardingData } from "@/types/onboarding"

type Props = {
  onNext: () => void
  onBack: () => void
  data: OnboardingData
  updateData: (data: Partial<OnboardingData>) => void
}

export default function OnboardingStep2({ onNext, onBack, data, updateData }: Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-2xl font-bold mb-2">📚 Estrutura Acadêmica</h2>
      <p className="text-sm text-gray-500 mb-6">
        Configure sua primeira turma e cursos principais.
      </p>

      <div>
        <label className="block text-sm font-medium mb-1">Turma inicial</label>
        <input
          type="text"
          value={data.className}
          onChange={(e) => updateData({ className: e.target.value })}
          placeholder="Ex: 1º Ano A"
          className="w-full border px-4 py-2 rounded-lg focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Cursos iniciais</label>
        <input
          type="text"
          value={data.subjects}
          onChange={(e) => updateData({ subjects: e.target.value })}
          placeholder="Ex: Matemática, Português, Ciências"
          className="w-full border px-4 py-2 rounded-lg focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
        />
        <p className="text-xs text-gray-400 mt-1">
          Separe os nomes por vírgula.
        </p>
      </div>

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
          className="px-6 py-3 rounded-lg bg-moxinexa-teal text-white hover:bg-teal-600"
        >
          Próximo
        </button>
      </div>
    </form>
  )
}
