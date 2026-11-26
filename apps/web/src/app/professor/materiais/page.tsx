"use client";

import { useSearchParams } from "next/navigation";
import { ProfessorMateriaisWorkspace } from "@/components/professor/ProfessorMateriaisWorkspace";

export default function ProfessorMateriaisPage() {
  const searchParams = useSearchParams();
  const requestedTurmaId = searchParams?.get("turma_id") ?? "";
  const requestedDisciplinaId = searchParams?.get("disciplina_id") ?? "";
  return <ProfessorMateriaisWorkspace key={JSON.stringify([requestedTurmaId, requestedDisciplinaId])} requestedTurmaId={requestedTurmaId} requestedDisciplinaId={requestedDisciplinaId} />;
}
