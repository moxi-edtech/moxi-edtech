"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { enqueueOfflineAction } from '@/lib/offline/queue'
import { createIdempotencyKey } from '@/lib/idempotency'
import { useOfflineStatus } from '@/hooks/useOfflineStatus'

type Atrib = { id: string; turma: { id: string; nome: string | null }; disciplina: { id: string; nome: string | null } }
type Aluno = { id: string; nome: string }

export default function ProfessorFrequenciasPage() {
  const [atribs, setAtribs] = useState<Atrib[]>([])
  const [turmaId, setTurmaId] = useState('')
  const [disciplinaId, setDisciplinaId] = useState('')
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [data, setData] = useState(() => new Date().toISOString().slice(0,10))
  const [saving, setSaving] = useState(false)
  const [statusMap, setStatusMap] = useState<Record<string, 'presente'|'falta'|'atraso'>>({})
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'pending' | 'saved' | 'failed'>('idle')
  const { online } = useOfflineStatus()

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/professor/atribuicoes', { cache: 'no-store' })
      const json = await res.json().catch(()=>null)
      if (res.ok && json?.ok) {
        setAtribs(json.items || [])
      }
    })()
  }, [])

  useEffect(() => {
    (async () => {
      if (!turmaId) { setAlunos([]); return }
      const res = await fetch(`/api/secretaria/turmas/${turmaId}/alunos`, { cache: 'no-store' })
      const json = await res.json().catch(()=>null)
      if (res.ok && json?.ok) setAlunos((json.items||[]).map((r:any)=>({ id: r.id || r.aluno_id || r.profile_id, nome: r.nome || r.aluno_nome || 'Aluno' })))
    })()
  }, [turmaId])

  useEffect(() => {
    setSubmitStatus('idle')
  }, [turmaId, disciplinaId, data])

  const atribsByTurma = useMemo(() => atribs.reduce((acc, a) => {
    const arr = acc.get(a.turma.id) || []
    arr.push(a)
    acc.set(a.turma.id, arr)
    return acc
  }, new Map<string, Atrib[]>()), [atribs])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (!turmaId || !disciplinaId) throw new Error('Selecione turma e disciplina.')
      const presencas = alunos.map(a => ({ aluno_id: a.id, status: statusMap[a.id] || 'presente' }))
      const idempotencyKey = createIdempotencyKey(`presencas-${turmaId}-${disciplinaId}-${data}`)
      const request = {
        url: '/api/professor/presencas',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({ turma_id: turmaId, disciplina_id: disciplinaId, data, presencas }),
        type: 'professor_presencas',
      }

      if (!online) {
        await enqueueOfflineAction(request)
        setSubmitStatus('pending')
        return
      }

      const res = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      })
      const json = await res.json().catch(()=>null)
      if (!res.ok || !json?.ok) {
        setSubmitStatus('failed')
        throw new Error(json?.error || 'Falha ao salvar presença')
      }
      setSubmitStatus('saved')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (!online) {
        setSubmitStatus('pending')
      } else {
        setSubmitStatus('failed')
      }
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4 text-klasse-green">Frequências</h1>
      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-900">Turma e disciplina</div>
            <select
              value={turmaId}
              onChange={(e) => {
                setTurmaId(e.target.value)
                setDisciplinaId('')
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
              required
            >
              <option value="">Turma</option>
              {Array.from(new Set(atribs.map((a) => a.turma.id))).map((tid) => (
                <option key={tid} value={tid}>
                  {atribs.find((a) => a.turma.id === tid)?.turma.nome || tid}
                </option>
              ))}
            </select>
            <select
              value={disciplinaId}
              onChange={(e) => setDisciplinaId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
              required
              disabled={!turmaId}
            >
              <option value="">Disciplina</option>
              {(atribsByTurma.get(turmaId) || []).map((a) => (
                <option key={a.disciplina.id} value={a.disciplina.id}>
                  {a.disciplina.nome || a.disciplina.id}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
              required
            />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 text-sm text-slate-600">
            <div className="font-semibold text-slate-900">Status</div>
            {submitStatus === 'saved' && <div>Presenças sincronizadas.</div>}
            {submitStatus === 'pending' && <div>Presenças pendentes (offline).</div>}
            {submitStatus === 'failed' && <div>Falha ao sincronizar presenças.</div>}
            {submitStatus === 'idle' && <div>Selecione turma, disciplina e data.</div>}
          </div>
          <button
            type="submit"
            disabled={saving || !turmaId || !disciplinaId}
            className="w-full rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Registrar presenças'}
          </button>
        </aside>
        <section className="rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-2">Aluno</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {alunos.map(a => (
                <tr key={a.id} className="border-t">
                  <td className="p-2">{a.nome}</td>
                  <td className="p-2">
                    <select
                      value={statusMap[a.id] || 'presente'}
                      onChange={(e)=>setStatusMap(s=>({ ...s, [a.id]: e.target.value as any }))}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-klasse-gold focus:ring-2 focus:ring-klasse-gold/20"
                    >
                      <option value="presente">Presente</option>
                      <option value="falta">Falta</option>
                      <option value="atraso">Atraso</option>
                    </select>
                  </td>
                </tr>
              ))}
              {alunos.length === 0 && (
                <tr>
                  <td colSpan={2} className="p-3 text-gray-500">
                    Selecione turma e disciplina para carregar alunos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </form>
    </div>
  )
}
