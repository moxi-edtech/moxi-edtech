"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { enqueueOfflineAction } from '@/lib/offline/queue'
import { createIdempotencyKey } from '@/lib/idempotency'
import { useOfflineStatus } from '@/hooks/useOfflineStatus'

type Atrib = { id: string; turma: { id: string; nome: string | null }; disciplina: { id: string; nome: string | null } }
type Aluno = { id: string; nome: string }
type Periodo = { id: string; numero: number; tipo: string; data_inicio: string; data_fim: string }

export default function ProfessorFrequenciasPage() {
  const [atribs, setAtribs] = useState<Atrib[]>([])
  const [escolaId, setEscolaId] = useState('')
  const [turmaId, setTurmaId] = useState('')
  const [disciplinaId, setDisciplinaId] = useState('')
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [data, setData] = useState(() => new Date().toISOString().slice(0,10))
  const [periodos, setPeriodos] = useState<Periodo[]>([])
  const [periodoId, setPeriodoId] = useState('')
  const [periodoClosed, setPeriodoClosed] = useState(false)
  const [closing, setClosing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusMap, setStatusMap] = useState<Record<string, 'presente'|'falta'|'atraso'>>({})
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'pending' | 'saved' | 'failed'>('idle')
  const [closeStatus, setCloseStatus] = useState<'idle' | 'pending' | 'saved' | 'failed'>('idle')
  const { online } = useOfflineStatus()

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/professor/atribuicoes', { cache: 'no-store' })
      const json = await res.json().catch(()=>null)
      if (res.ok && json?.ok) {
        setAtribs(json.items || [])
        setEscolaId(json.escola_id || '')
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
    (async () => {
      if (!turmaId) { setPeriodos([]); setPeriodoId(''); return }
      const res = await fetch(`/api/professor/periodos?turma_id=${encodeURIComponent(turmaId)}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.ok) {
        const items = json.items || []
        setPeriodos(items)
        if (!periodoId && items.length > 0) {
          const today = new Date(data)
          const matching = items.find((p: Periodo) => {
            const inicio = new Date(p.data_inicio)
            const fim = new Date(p.data_fim)
            return today >= inicio && today <= fim
          })
          setPeriodoId(matching?.id || items[0].id)
        }
      }
    })()
  }, [turmaId, data])

  useEffect(() => {
    (async () => {
      if (!escolaId || !turmaId || !periodoId) { setPeriodoClosed(false); return }
      const res = await fetch(
        `/api/escola/${escolaId}/admin/frequencias/fechar-periodo?turma_id=${encodeURIComponent(turmaId)}&periodo_letivo_id=${encodeURIComponent(periodoId)}`,
        { cache: 'no-store' }
      )
      const json = await res.json().catch(() => null)
      if (res.ok && json?.ok) {
        setPeriodoClosed(Boolean(json.closed))
      }
    })()
  }, [escolaId, turmaId, periodoId])

  useEffect(() => {
    setSubmitStatus('idle')
  }, [turmaId, disciplinaId, data])

  useEffect(() => {
    setCloseStatus('idle')
  }, [periodoId])

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
      if (periodoClosed) {
        throw new Error('Período fechado para frequência.')
      }
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
      if (message.includes('Período letivo não resolvido')) {
        alert('Calendário do período não cobre esta data. Ajuste em Configurações → Ano letivo.')
      } else {
        if (!online) {
          setSubmitStatus('pending')
        } else {
          setSubmitStatus('failed')
        }
        alert(message)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleClosePeriodo = async () => {
    if (!escolaId || !turmaId || !periodoId) return
    setClosing(true)
    try {
      const idempotencyKey = createIdempotencyKey(`frequencias-fechar-${turmaId}-${periodoId}`)
      const request = {
        url: `/api/escola/${escolaId}/admin/frequencias/fechar-periodo`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({ turma_id: turmaId, periodo_letivo_id: periodoId }),
        type: 'frequencias_fechar_periodo',
      }

      if (!online) {
        await enqueueOfflineAction(request)
        setCloseStatus('pending')
        return
      }

      const res = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        setCloseStatus('failed')
        throw new Error(json?.error || 'Falha ao fechar período')
      }
      setPeriodoClosed(true)
      setCloseStatus('saved')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (!online) {
        setCloseStatus('pending')
      } else {
        setCloseStatus('failed')
      }
      alert(message)
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Registrar Presenças</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="rounded border bg-white p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Fechamento de frequência</h2>
              <p className="text-xs text-slate-500">Selecione o período e confirme o fechamento.</p>
            </div>
            <div className={`text-xs font-semibold ${periodoClosed ? 'text-emerald-600' : 'text-amber-600'}`}>
              {closeStatus === 'pending'
                ? 'Pendente 🟡'
                : closeStatus === 'failed'
                ? 'Falhou 🔴'
                : periodoClosed
                ? 'Fechado ✅'
                : 'Aberto ⚠️'}
            </div>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <select
              value={periodoId}
              onChange={(e) => setPeriodoId(e.target.value)}
              className="border rounded p-2 text-sm"
              disabled={periodos.length === 0}
            >
              <option value="">Selecione o período</option>
              {periodos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.tipo} {p.numero} ({p.data_inicio} → {p.data_fim})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={closing || !periodoId || periodoClosed}
              onClick={handleClosePeriodo}
              className="px-4 py-2 bg-slate-900 text-white rounded text-sm font-semibold disabled:opacity-50"
            >
              {closing ? 'Fechando...' : 'Fechar período'}
            </button>
          </div>
          {periodos.length === 0 && (
            <p className="text-xs text-amber-600">
              Nenhum período encontrado para o ano letivo da turma.
            </p>
          )}
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <select value={turmaId} onChange={(e)=>{ setTurmaId(e.target.value); setDisciplinaId('') }} className="border rounded p-2" required>
            <option value="">Selecione a turma</option>
            {Array.from(new Set(atribs.map(a => a.turma.id))).map(tid => (
              <option key={tid} value={tid}>{atribs.find(a=>a.turma.id===tid)?.turma.nome || tid}</option>
            ))}
          </select>
          <select value={disciplinaId} onChange={(e)=>setDisciplinaId(e.target.value)} className="border rounded p-2" required disabled={!turmaId}>
            <option value="">Selecione a disciplina</option>
            {(atribsByTurma.get(turmaId) || []).map(a => (
              <option key={a.disciplina.id} value={a.disciplina.id}>{a.disciplina.nome || a.disciplina.id}</option>
            ))}
          </select>
          <input type="date" value={data} onChange={(e)=>setData(e.target.value)} className="border rounded p-2" required />
        </div>
        <div className="rounded border">
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
                    <select value={statusMap[a.id] || 'presente'} onChange={(e)=>setStatusMap(s=>({ ...s, [a.id]: e.target.value as any }))} className="border rounded p-1">
                      <option value="presente">Presente</option>
                      <option value="falta">Falta</option>
                      <option value="atraso">Atraso</option>
                    </select>
                  </td>
                </tr>
              ))}
              {alunos.length === 0 && <tr><td colSpan={2} className="p-3 text-gray-500">Selecione turma para carregar alunos</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={saving || !turmaId || !disciplinaId || periodoClosed} className="px-4 py-2 bg-emerald-600 text-white rounded disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar presenças'}
          </button>
        </div>
        {submitStatus !== 'idle' && (
          <div className="text-xs text-slate-500">
            {submitStatus === 'saved' && '✅ Presenças sincronizadas.'}
            {submitStatus === 'pending' && '🟡 Presenças pendentes (offline).'}
            {submitStatus === 'failed' && '🔴 Falha ao sincronizar presenças.'}
          </div>
        )}
      </form>
    </div>
  )
}
