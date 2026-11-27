"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ProfessorCalendarWorkspace } from "@/components/professor/ProfessorCalendarWorkspace";

function CalendarRoute() {
  const params = useSearchParams();
  const academicYearId = params?.get("ano_letivo_id") ?? "";
  return <ProfessorCalendarWorkspace key={academicYearId} academicYearId={academicYearId} />;
}
export default function ProfessorCalendarioPage() {
  return <Suspense fallback={<p role="status" className="p-4 text-sm text-muted-foreground">A carregar calendário…</p>}><CalendarRoute /></Suspense>;
}
