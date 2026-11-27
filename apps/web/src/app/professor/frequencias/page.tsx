"use client";

import { useSearchParams } from "next/navigation";
import { ACADEMIC_YEAR_PARAM } from "@/lib/academic-year/context";
import { ProfessorFrequenciasWorkspace } from "@/components/professor/ProfessorFrequenciasWorkspace";

export default function ProfessorFrequenciasPage() {
  const searchParams = useSearchParams();
  const requestedAcademicYearId = searchParams?.get(ACADEMIC_YEAR_PARAM) ?? "";
  const urlTurmaId = searchParams?.get("turma_id") ?? null;
  const urlDisciplinaId = searchParams?.get("disciplina_id") ?? null;
  return <ProfessorFrequenciasWorkspace key={JSON.stringify([requestedAcademicYearId, urlTurmaId, urlDisciplinaId])} requestedAcademicYearId={requestedAcademicYearId} urlTurmaId={urlTurmaId} urlDisciplinaId={urlDisciplinaId} />;
}
