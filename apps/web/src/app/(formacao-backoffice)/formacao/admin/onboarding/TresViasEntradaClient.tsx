'use client'

import { useMemo, useState } from 'react'
import { Check, Eye, Filter, Plus, Trash2 } from 'lucide-react'

type ViaKey = 'balcao' | 'b2b_upload' | 'self_service'

type ApiResult = {
  ok: boolean
  error?: string
  code?: string
  [k: string]: unknown
}

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold'

const buttonPrimary =
  'inline-flex items-center gap-2 rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60'

const buttonSecondary =
  'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:text-klasse-gold'

const buttonDanger =
  'inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-95'

const viaItems: Array<{ key: ViaKey; label: string; description: string }> = [
  { key: 'balcao', label: 'Via A · Balcão', description: 'Secretaria registra 1 formando por vez com validação de BI.' },
  { key: 'b2b_upload', label: 'Via B · Upload B2B', description: 'Upload em lote para empresas com deduplicação por BI.' },
  { key: 'self_service', label: 'Via C · Self-Service', description: 'Inscrição via link público/token de turma.' },
]

function parseLote(raw: string) {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [nome = '', bi_numero = '', email = '', telefone = ''] = line.split(';').map((x) => x.trim())
      return { nome, bi_numero, email, telefone }
    })
}

export default function TresViasEntradaClient() {
  const [via, setVia] = useState<ViaKey>('balcao')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ApiResult | null>(null)

  const [balcao, setBalcao] = useState({
    nome: '',
    bi_numero: '',
    email: '',
    telefone: '',
    curso_id: '',
    turma_id: '',
    ano_letivo: new Date().getFullYear(),
    enforce_capacidade: true,
  })

  const [b2b, setB2b] = useState({
    empresa_nome: '',
    empresa_nif: '',
    curso_id: '',
    turma_id: '',
    ano_letivo: new Date().getFullYear(),
    lote_raw: '',
  })

  const [selfService, setSelfService] = useState({
    nome: '',
    bi_numero: '',
    email: '',
    telefone: '',
    curso_id: '',
    turma_id: '',
    landing_slug: '',
  })

  const parsedLote = useMemo(() => parseLote(b2b.lote_raw), [b2b.lote_raw])

  async function submit(payload: Record<string, unknown>) {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/formacao/admissoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as ApiResult
      setResult(json)
    } catch {
      setResult({ ok: false, error: 'Falha de rede ao enviar admissão.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-sm font-semibold text-[#1F6B3B]">3 Vias de Entrada — Formação</h1>
        <p className="mt-2 text-sm text-slate-600">
          MVP operacional para Balcão, Upload B2B e Self-Service com anti-duplicidade por BI no backend.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {viaItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setVia(item.key)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                via === item.key
                  ? 'border-klasse-gold bg-slate-900 text-klasse-gold ring-1 ring-klasse-gold/25'
                  : 'border-slate-200 bg-white text-slate-700 hover:text-klasse-gold'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-500">{viaItems.find((v) => v.key === via)?.description}</p>
      </div>

      {via === 'balcao' && (
        <form
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault()
            submit({ via: 'balcao', ...balcao, curso_id: balcao.curso_id || undefined, turma_id: balcao.turma_id || undefined })
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input className={inputCls} placeholder="Nome" value={balcao.nome} onChange={(e) => setBalcao((s) => ({ ...s, nome: e.target.value }))} />
            <input className={inputCls} placeholder="BI" value={balcao.bi_numero} onChange={(e) => setBalcao((s) => ({ ...s, bi_numero: e.target.value }))} />
            <input className={inputCls} placeholder="Email" type="email" value={balcao.email} onChange={(e) => setBalcao((s) => ({ ...s, email: e.target.value }))} />
            <input className={inputCls} placeholder="Telefone" value={balcao.telefone} onChange={(e) => setBalcao((s) => ({ ...s, telefone: e.target.value }))} />
            <input className={inputCls} placeholder="Curso ID (uuid)" value={balcao.curso_id} onChange={(e) => setBalcao((s) => ({ ...s, curso_id: e.target.value }))} />
            <input className={inputCls} placeholder="Turma ID (uuid)" value={balcao.turma_id} onChange={(e) => setBalcao((s) => ({ ...s, turma_id: e.target.value }))} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="submit" className={buttonPrimary} disabled={loading}>
              <Plus className="h-4 w-4" />
              <span>Criar candidatura (Balcão)</span>
            </button>
            <button type="button" className={buttonSecondary} onClick={() => setBalcao((s) => ({ ...s, enforce_capacidade: !s.enforce_capacidade }))}>
              <Filter className="h-4 w-4" />
              <span>{balcao.enforce_capacidade ? 'Capacidade ON' : 'Capacidade OFF'}</span>
            </button>
          </div>
        </form>
      )}

      {via === 'b2b_upload' && (
        <form
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault()
            submit({
              via: 'b2b_upload',
              empresa_nome: b2b.empresa_nome,
              empresa_nif: b2b.empresa_nif || undefined,
              curso_id: b2b.curso_id || undefined,
              turma_id: b2b.turma_id || undefined,
              ano_letivo: b2b.ano_letivo,
              formandos: parsedLote,
            })
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input className={inputCls} placeholder="Empresa" value={b2b.empresa_nome} onChange={(e) => setB2b((s) => ({ ...s, empresa_nome: e.target.value }))} />
            <input className={inputCls} placeholder="NIF empresa" value={b2b.empresa_nif} onChange={(e) => setB2b((s) => ({ ...s, empresa_nif: e.target.value }))} />
            <input className={inputCls} placeholder="Curso ID (uuid)" value={b2b.curso_id} onChange={(e) => setB2b((s) => ({ ...s, curso_id: e.target.value }))} />
            <input className={inputCls} placeholder="Turma ID (uuid)" value={b2b.turma_id} onChange={(e) => setB2b((s) => ({ ...s, turma_id: e.target.value }))} />
          </div>

          <textarea
            className={`${inputCls} mt-3 min-h-40`}
            placeholder="Cole linhas no formato: nome;bi;email;telefone"
            value={b2b.lote_raw}
            onChange={(e) => setB2b((s) => ({ ...s, lote_raw: e.target.value }))}
          />

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Registos no lote: <strong>{parsedLote.length}</strong>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="submit" className={buttonPrimary} disabled={loading}>
              <Plus className="h-4 w-4" />
              <span>Processar lote B2B</span>
            </button>
            <button type="button" className={buttonDanger} onClick={() => setB2b((s) => ({ ...s, lote_raw: '' }))}>
              <Trash2 className="h-4 w-4" />
              <span>Limpar lote</span>
            </button>
          </div>
        </form>
      )}

      {via === 'self_service' && (
        <form
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault()
            submit({ via: 'self_service', ...selfService, curso_id: selfService.curso_id || undefined, turma_id: selfService.turma_id || undefined })
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input className={inputCls} placeholder="Nome" value={selfService.nome} onChange={(e) => setSelfService((s) => ({ ...s, nome: e.target.value }))} />
            <input className={inputCls} placeholder="BI" value={selfService.bi_numero} onChange={(e) => setSelfService((s) => ({ ...s, bi_numero: e.target.value }))} />
            <input className={inputCls} placeholder="Email" type="email" value={selfService.email} onChange={(e) => setSelfService((s) => ({ ...s, email: e.target.value }))} />
            <input className={inputCls} placeholder="Telefone" value={selfService.telefone} onChange={(e) => setSelfService((s) => ({ ...s, telefone: e.target.value }))} />
            <input className={inputCls} placeholder="Curso ID (uuid)" value={selfService.curso_id} onChange={(e) => setSelfService((s) => ({ ...s, curso_id: e.target.value }))} />
            <input className={inputCls} placeholder="Turma ID (uuid)" value={selfService.turma_id} onChange={(e) => setSelfService((s) => ({ ...s, turma_id: e.target.value }))} />
            <input className={inputCls} placeholder="Landing slug" value={selfService.landing_slug} onChange={(e) => setSelfService((s) => ({ ...s, landing_slug: e.target.value }))} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="submit" className={buttonPrimary} disabled={loading}>
              <Check className="h-4 w-4" />
              <span>Submeter self-service</span>
            </button>
            <button type="button" className={buttonSecondary} onClick={() => submit({ via: 'self_service', ...selfService, preview: true })}>
              <Eye className="h-4 w-4" />
              <span>Pré-validar payload</span>
            </button>
          </div>
        </form>
      )}

      {result && (
        <div
          className={`rounded-xl border p-4 text-sm shadow-sm ${
            result.ok ? 'border-[#1F6B3B]/20 bg-[#1F6B3B]/10 text-[#1F6B3B]' : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
