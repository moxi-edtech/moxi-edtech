"use client";

import { useState } from "react";
import RequireSuperAdmin from "@/app/(guards)/RequireSuperAdmin";

type PreviewResponse = {
  ok: boolean
  preview?: { subject: string; html: string; text?: string }
  meta?: { escolaId: string; escolaNome: string | null; adminEmail: string; mode: string; actionLink: string | null; redirectTo: string }
  error?: string
}

function EmailPreviewClient() {
  const [escolaId, setEscolaId] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [mode, setMode] = useState<'invite' | 'magic'>("invite")
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<PreviewResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setErr(null)
    setData(null)
    try {
      const p = new URLSearchParams()
      p.set('escolaId', escolaId.trim())
      if (adminEmail.trim()) p.set('adminEmail', adminEmail.trim())
      p.set('mode', mode)
      const res = await fetch(`/api/debug/email?${p.toString()}`)
      const json = (await res.json()) as PreviewResponse
      if (!res.ok || !json.ok) throw new Error(json.error || 'Falha ao gerar preview')
      setData(json)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const subject = data?.preview?.subject || ''
  const text = data?.preview?.text || ''
  const html = data?.preview?.html || ''
  const meta = data?.meta

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Preview de E-mail • Onboarding</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Escola ID *</label>
            <input value={escolaId} onChange={e=>setEscolaId(e.target.value)} className="border rounded w-full p-2" placeholder="ex: 7e0c0e86-..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Admin Email (opcional)</label>
            <input value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} className="border rounded w-full p-2" placeholder="admin@escola.com" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Modo do Link</label>
            <select value={mode} onChange={e=>setMode(e.target.value as any)} className="border rounded w-full p-2">
              <option value="invite">Convite (criar senha)</option>
              <option value="magic">Magic Link (acesso direto)</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={!escolaId || loading} className="px-4 py-2 rounded text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Gerando…' : 'Gerar Preview'}
          </button>
          {meta?.actionLink && (
            <a href={meta.actionLink} target="_blank" rel="noreferrer" className="px-4 py-2 rounded border">
              Abrir Link de Ação
            </a>
          )}
          {meta?.redirectTo && (
            <a href={meta.redirectTo} target="_blank" rel="noreferrer" className="px-4 py-2 rounded border">
              Abrir Redirect
            </a>
          )}
        </div>
        {err && <div className="text-red-600">Erro: {err}</div>}
      </div>

      {data?.ok && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow p-4 space-y-3">
            <div className="font-semibold">Subject</div>
            <div className="font-mono text-sm break-words">{subject}</div>
            <div className="font-semibold">Texto</div>
            <pre className="text-xs bg-slate-50 rounded p-3 overflow-auto max-h-96 whitespace-pre-wrap">{text}</pre>
          </div>
          <div className="bg-white rounded-lg shadow p-4 space-y-3">
            <div className="font-semibold">HTML</div>
            <div className="border rounded overflow-hidden">
              <iframe title="preview" className="w-full h-96" sandbox="allow-same-origin" srcDoc={html}></iframe>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Page() {
  return (
    <RequireSuperAdmin>
      <EmailPreviewClient />
    </RequireSuperAdmin>
  )
}

