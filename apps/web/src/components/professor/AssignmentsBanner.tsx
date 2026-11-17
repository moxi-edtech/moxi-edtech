"use client"

type AssignmentsBannerProps = {
  loading: boolean
  hasAssignments: boolean
  hasError: boolean
  academicYearLabel?: string | null
}

export default function AssignmentsBanner({
  loading,
  hasAssignments,
  hasError,
  academicYearLabel,
}: AssignmentsBannerProps) {
  // Never confuse a failed request with an empty assignment set.
  if (loading || hasAssignments || hasError) return null

  const period = academicYearLabel ? `em ${academicYearLabel}` : 'no ano letivo selecionado'

  return (
    <div role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
      <p className="mb-1 font-semibold">Sem atribuições neste ano letivo</p>
      <p className="text-sm">
        Não há turmas ou disciplinas atribuídas {period}. A Secretaria pode associar as turmas
        deste ano no cadastro do professor.
      </p>
    </div>
  )
}
