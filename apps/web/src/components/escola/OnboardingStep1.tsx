// /components/escola/OnboardingStep1.tsx
"use client"

import { useState } from "react"
import Image from "next/image"

import { OnboardingData } from "@/types/onboarding"

type Props = { 
  onNext: () => void
  data: OnboardingData
  updateData: (data: Partial<OnboardingData>) => void
}

export default function OnboardingStep1({ onNext, data, updateData }: Props) {
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      updateData({ logo: file })
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onNext()
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">🎨 Personalize sua Escola</h2>
      <p className="text-sm text-gray-500 mb-6">Defina como sua escola será apresentada no sistema.</p>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome da escola
          </label>
          <input
            type="text"
            value={data.schoolName}
            onChange={(e) => updateData({ schoolName: e.target.value })}
            placeholder="Nome da escola"
            className="w-full border px-4 py-2 rounded-lg focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cor primária
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="color"
              value={data.primaryColor}
              onChange={(e) => updateData({ primaryColor: e.target.value })}
              className="w-12 h-12 border rounded cursor-pointer"
            />
            <span className="text-sm text-gray-500">{data.primaryColor}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Logo da escola (opcional)
          </label>
          <div className="flex items-center space-x-4">
            <div className="relative">
              {logoPreview ? (
                <Image
                  src={logoPreview}
                  alt="Preview"
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-full object-cover border"
                  unoptimized
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400">Logo</span>
                </div>
              )}
              <label htmlFor="logo-upload" className="absolute bottom-0 right-0 bg-moxinexa-teal text-white rounded-full p-1 cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </label>
            </div>
            <span className="text-sm text-gray-500">Clique para adicionar/alterar</span>
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            className="w-full bg-moxinexa-teal text-white px-6 py-3 rounded-lg hover:bg-teal-600 transition-colors"
          >
            Próximo
          </button>
        </div>
      </form>
    </div>
  )
}
