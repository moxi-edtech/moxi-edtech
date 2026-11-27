import type { SupabaseClient } from "@supabase/supabase-js";
import { AcademicYearContextError, resolveAcademicYearScope } from "@/lib/academic-year/context";

/** Resolve the canonical year from the actual turma, never from client claims. */
export async function assertProfessorLessonYear(db: SupabaseClient, escolaId: string, turmaId: string, requestedYearId?: string) {
  const { data: turma, error } = await db.from("turmas").select("session_id").eq("escola_id", escolaId).eq("id", turmaId).maybeSingle();
  if (error) throw error;
  if (!turma?.session_id) throw new AcademicYearContextError("ACADEMIC_ENTITY_NOT_FOUND", 404, "Turma sem ano lectivo válido.");
  if (requestedYearId && turma.session_id !== requestedYearId) throw new AcademicYearContextError("CROSS_YEAR_ENTITY_MISMATCH", 409, "A aula não pertence ao ano lectivo seleccionado.");
  return resolveAcademicYearScope(db, { escolaId, requestedAcademicYearId: turma.session_id, operation: "WRITE" });
}

export async function assertProfessorLessonAssignmentYear(db: SupabaseClient, escolaId: string, turmaDisciplinaId: string, requestedYearId?: string) {
  const { data: assignment, error } = await db.from("turma_disciplinas").select("turma_id").eq("escola_id", escolaId).eq("id", turmaDisciplinaId).maybeSingle();
  if (error) throw error;
  if (!assignment?.turma_id) throw new AcademicYearContextError("ACADEMIC_ENTITY_NOT_FOUND", 404, "Vínculo académico indisponível.");
  return assertProfessorLessonYear(db, escolaId, assignment.turma_id, requestedYearId);
}
