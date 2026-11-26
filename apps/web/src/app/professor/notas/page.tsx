"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { ProfessorGradesWorkspace } from "@/components/professor/ProfessorGradesWorkspace"

function GradeRoute() {
  const params = useSearchParams()
  const scope = [params?.get("ano_letivo_id") ?? "", params?.get("turma_id") ?? "", params?.get("disciplina_id") ?? "", params?.get("trimestre") ?? null, params?.get("alunoId") ?? null] as const
  return <ProfessorGradesWorkspace key={JSON.stringify(scope)} requestedAnoLetivoId={scope[0]} requestedTurmaId={scope[1]} requestedDisciplinaId={scope[2]} requestedTerm={scope[3]} highlightAlunoId={scope[4]} />
}

export default function ProfessorNotasPage() {
  return <Suspense fallback={<div role="status" className="p-6 text-sm text-muted-foreground">A carregar pauta...</div>}><GradeRoute /></Suspense>
}
