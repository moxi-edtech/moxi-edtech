"use client";

import { useParams } from "next/navigation";
import { ProfessorTurmaHorario } from "@/components/professor/ProfessorTurmaHorario";

export default function ProfessorTurmaHorarioPage() {
  const params = useParams<{ turmaId: string }>();
  return <ProfessorTurmaHorario key={params?.turmaId} turmaId={params?.turmaId} />;
}
