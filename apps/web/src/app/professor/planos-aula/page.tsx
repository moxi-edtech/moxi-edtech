"use client";

import { useSearchParams } from "next/navigation";
import { ProfessorPlanosWorkspace } from "@/components/professor/ProfessorPlanosWorkspace";

export default function PlanosAulaPage() {
  const searchParams = useSearchParams();
  const requestedTurmaId = searchParams?.get("turma_id") ?? "";
  const requestedDisciplinaId = searchParams?.get("disciplina_id") ?? "";
  return <ProfessorPlanosWorkspace key={JSON.stringify([requestedTurmaId, requestedDisciplinaId])} requestedTurmaId={requestedTurmaId} requestedDisciplinaId={requestedDisciplinaId} />;
}
