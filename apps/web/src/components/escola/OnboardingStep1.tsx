// /components/escola/OnboardingStep1.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"

import { OnboardingData } from "@/types/onboarding"
import { createClient } from "@/lib/supabaseClient"

type Props = { 
  onNext: () => void
  escolaId: string
  data: OnboardingData
  updateData: (data: Partial<OnboardingData>) => void
}

export default function OnboardingStep1({ onNext, escolaId, data, updateData }: Props) {
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (data.logoUrl && !logoPreview) setLogoPreview(data.logoUrl)
  }, [data.logoUrl, logoPreview])

  const extractPathFromPublicUrl = (url: string | null | undefined): string | null => {
    if (!url) return null
    try {
      const marker = "/storage/v1/object/public/escola-logos/"
      const idx = url.indexOf(marker)
      if (idx === -1) return null
      return url.substring(idx + marker.length)
    } catch {
      return null
    }
  }

  const enqueueCleanup = (path: string) => {
    try {
      const key = `onboarding:${escolaId}:cleanupPaths`
      const raw = window.localStorage.getItem(key)
      const arr: string[] = raw ? JSON.parse(raw) : []
      if (!arr.includes(path)) arr.push(path)
      window.localStorage.setItem(key, JSON.stringify(arr))
    } catch (_) {}
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      updateData({ logo: file })
      // Preview imediato
      try {
        const reader = new FileReader()
        reader.onloadend = () => {
          setLogoPreview(reader.result as string)
        }
        reader.readAsDataURL(file)
      } catch (_) {}

      // Upload para Storage (bucket: escola-logos)
      try {
        setUploading(true)
        const oldUrl = data.logoUrl || null
        const ext = file.name.split('.').pop() || 'png'
        const path = `${escolaId}/logo-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('escola-logos')
          .upload(path, file, { upsert: true, contentType: file.type })
        if (upErr) {
          console.error('Erro upload logo:', upErr)
          return
        }
        const { data: pub } = supabase.storage.from('escola-logos').getPublicUrl(path)
        if (pub?.publicUrl) {
          updateData({ logoUrl: pub.publicUrl })
          setLogoPreview(pub.publicUrl)
          // Sincroniza imediatamente o rascunho no servidor com a nova logo
          try {
            const payload = {
              data: {
                schoolName: data.schoolName,
                primaryColor: data.primaryColor,
                logoUrl: pub.publicUrl,
                className: data.className,
                subjects: data.subjects,
                teacherEmail: data.teacherEmail,
                staffEmail: data.staffEmail,
              },
            }
            fetch(`/api/escolas/${escolaId}/onboarding/draft`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }).catch(() => {})
          } catch (_) {}
          // Remove a logo antiga (best-effort) se for do mesmo bucket
          const oldPath = extractPathFromPublicUrl(oldUrl)
          if (oldPath && oldPath !== path) {
            try {
              await supabase.storage.from('escola-logos').remove([oldPath])
            } catch (_) {
              enqueueCleanup(oldPath)
            }
          }
        }
      } finally {
        setUploading(false)
      }
    }
  }

  const handleRemoveLogo = async () => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm('Deseja remover a logo atual?')
      if (!ok) return
    }
    const oldUrl = data.logoUrl || null
    const oldPath = extractPathFromPublicUrl(oldUrl)
    try {
      setUploading(true)
      if (oldPath) {
        try {
          await supabase.storage.from('escola-logos').remove([oldPath])
        } catch (_) {
          enqueueCleanup(oldPath)
        }
      }
    } catch (err) {
      console.warn('Falha ao remover logo antiga:', err)
    } finally {
      setUploading(false)
      updateData({ logoUrl: null, logo: null })
      setLogoPreview(null)
      // Sincroniza remoção imediatamente com servidor
      try {
        const payload = {
          data: {
            schoolName: data.schoolName,
            primaryColor: data.primaryColor,
            logoUrl: null,
            className: data.className,
            subjects: data.subjects,
            teacherEmail: data.teacherEmail,
            staffEmail: data.staffEmail,
          },
        }
        fetch(`/api/escolas/${escolaId}/onboarding/draft`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {})
      } catch (_) {}
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
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-500">
                {uploading ? 'Processando…' : 'Clique para adicionar/alterar'}
              </span>
              {data.logoUrl && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={uploading}
                  className="text-xs text-red-600 hover:underline disabled:text-red-300"
                >
                  Remover logo
                </button>
              )}
            </div>
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
