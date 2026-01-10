"use client"

import React, { useEffect, useMemo, useState } from 'react'

type Atrib = { id: string; turma: { id: string; nome: string | null }; disciplina: { id: string; nome: string | null } }
type Aluno = { id: string; nome: string }

export default function ProfessorNotasPage() {
  const [atribs, setAtribs] = useState<Atrib[]>([])
  const [turmaId, setTurmaId] = useState('')
  const [disciplinaId, setDisciplinaId] = useState('')
  const [disciplinaNome, setDisciplinaNome] = useState<string | null>(null)
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [saving, setSaving] = useState(false)
  const [notaMap, setNotaMap] = useState<Record<string, string>>({})

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

  useEffect(() => {
    const a = atribs.find(x => x.turma.id === turmaId && x.disciplina.id === disciplinaId)
    setDisciplinaNome(a?.disciplina.nome || null)
  }, [atribs, turmaId, disciplinaId])

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
      const notas = alunos
        .map(a => ({ aluno_id: a.id, valor: Number(notaMap[a.id] || '') }))
        .filter(n => Number.isFinite(n.valor))
      const res = await fetch('/api/professor/notas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turma_id: turmaId, disciplina_id: disciplinaId, disciplina_nome: disciplinaNome || undefined, notas })
      })
      const json = await res.json().catch(()=>null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao salvar notas')
      alert('Notas salvas')
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Lançar Notas</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
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
        </div>
        <div className="rounded border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-2">Aluno</th>
                <th className="p-2">Nota</th>
              </tr>
            </thead>
            <tbody>
              {alunos.map(a => (
                <tr key={a.id} className="border-t">
                  <td className="p-2">{a.nome}</td>
                  <td className="p-2">
                    <input type="number" min={0} max={100} step={0.1} value={notaMap[a.id] || ''} onChange={(e)=>setNotaMap(m=>({ ...m, [a.id]: e.target.value }))} className="border rounded p-1 w-24" />
                  </td>
                </tr>
              ))}
              {alunos.length === 0 && <tr><td colSpan={2} className="p-3 text-gray-500">Selecione turma para carregar alunos</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={saving || !turmaId || !disciplinaId} className="px-4 py-2 bg-emerald-600 text-white rounded disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar notas'}
          </button>
        </div>
      </form>
    </div>
  )
}
