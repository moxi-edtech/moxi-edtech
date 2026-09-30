"use client"

import { useEffect, useState } from 'react'

export default function AssignmentsBanner() {
  const [loading, setLoading] = useState(true)
  const [has, setHas] = useState<boolean>(true)
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch('/api/professor/atribuicoes')
        const json = await res.json().catch(()=>null)
        if (!active) return
        setHas(res.ok && json?.ok && Array.isArray(json.items) && json.items.length > 0)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  if (loading || has) return null

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
      <div className="font-semibold mb-1">Sem atribuições ativas</div>
      <p className="text-sm">
        Você ainda não possui turmas/disciplinas atribuídas. Solicite à Secretaria/Coordenação a atribuição de disciplina na sua turma.
      </p>
    </div>
  )
}
