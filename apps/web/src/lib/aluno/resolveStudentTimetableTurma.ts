import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { AcademicYearContextError } from "@/lib/academic-year/context";

type Enrollment = { turma_id: string | null; session_id: string | null };
type Result = {
  turmaId: string | null;
  reason: "NO_ENROLLMENT" | "NO_CLASS" | null;
};

/**
 * O horário pertence à matrícula do ano e à turma desse mesmo ano.
 * Nunca substituir uma turma histórica pela turma ativa mais recente.
 */
export async function resolveStudentTimetableTurma(
  supabase: SupabaseClient<Database>,
  input: { escolaId: string; anoLetivoId: string; matricula: Enrollment | null },
): Promise<Result> {
  if (!input.matricula) return { turmaId: null, reason: "NO_ENROLLMENT" };

  if (input.matricula.session_id !== input.anoLetivoId) {
    throw new AcademicYearContextError(
      "CROSS_YEAR_ENTITY_MISMATCH", 409, "A matrícula não pertence ao ano letivo selecionado.",
    );
  }

  if (!input.matricula.turma_id) return { turmaId: null, reason: "NO_CLASS" };

  const { data: turma, error } = await supabase
    .from("turmas")
    .select("id, session_id")
    .eq("id", input.matricula.turma_id)
    .eq("escola_id", input.escolaId)
    .eq("ano_letivo_id", input.anoLetivoId)
    .maybeSingle();

  if (error) throw error;
  if (!turma || (turma.session_id != null && turma.session_id !== input.anoLetivoId)) {
    throw new AcademicYearContextError(
      "CROSS_YEAR_ENTITY_MISMATCH", 409, "A turma não pertence ao ano letivo selecionado.",
    );
  }

  return { turmaId: turma.id, reason: null };
}
