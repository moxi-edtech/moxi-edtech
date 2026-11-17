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
  if (loading || hasAssignments || hasError) return null

  return (
    <div role="status" className="mb-4 rounded-xl border border-border bg-muted px-4 py-2.5 text-sm text-muted-foreground">
      Sem turmas atribuídas {academicYearLabel ? `em ${academicYearLabel}` : "neste ano letivo"}.
    </div>
  )
}
