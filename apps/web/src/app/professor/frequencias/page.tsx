"use client"

import React, { useEffect, useMemo, useState } from 'react'

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

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/professor/atribuicoes', { cache: 'force-cache' })
      const json = await res.json().catch(()=>null)
      if (res.ok && json?.ok) setAtribs(json.items || [])
    })()
  }, [])

  useEffect(() => {
    (async () => {
      if (!turmaId) { setAlunos([]); return }
      const res = await fetch(`/api/secretaria/turmas/${turmaId}/alunos`, { cache: 'force-cache' })
      const json = await res.json().catch(()=>null)
      if (res.ok && json?.ok) setAlunos((json.items||[]).map((r:any)=>({ id: r.id || r.aluno_id || r.profile_id, nome: r.nome || r.aluno_nome || 'Aluno' })))
    })()
  }, [turmaId])

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
      const presencas = alunos.map(a => ({ aluno_id: a.id, status: statusMap[a.id] || 'presente' }))
      const res = await fetch('/api/professor/presencas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turma_id: turmaId, disciplina_id: disciplinaId, data, presencas })
      })
      const json = await res.json().catch(()=>null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao salvar presença')
      alert('Presenças salvas')
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Registrar Presenças</h1>
      <form onSubmit={onSubmit} className="space-y-4">
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
          <button type="submit" disabled={saving || !turmaId || !disciplinaId} className="px-4 py-2 bg-emerald-600 text-white rounded disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar presenças'}
          </button>
        </div>
      </form>
    </div>
  )
}
