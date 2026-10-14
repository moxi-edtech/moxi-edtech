import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { AcademicYearContextError, resolveAcademicYearContext } from "@/lib/academic-year/context";

/**
 * Fonte única de matrícula/ano para o portal do aluno.
 * Histórico pode ser consultado, mas não pode iniciar uma cobrança nova.
 * Nunca usar "matrícula mais recente" como substituto de session_id.
 */
export async function resolveBoletimMatricula(
  supabase: SupabaseClient<Database>,
  input: {
    escolaId: string;
    alunoId: string;
    userId: string;
    anoLetivoId?: string | null;
    operation?: "READ" | "WRITE";
  },
) {
  const context = await resolveAcademicYearContext(supabase, {
    userId: input.userId,
    requestedAcademicYearId: input.anoLetivoId ?? null,
    operation: "READ",
  });
  if (context.escolaId !== input.escolaId) {
    throw new AcademicYearContextError("CROSS_YEAR_ENTITY_MISMATCH", 409, "O ano letivo não pertence à escola do aluno.");
  }
  const { data, error } = await supabase.from("matriculas")
    .select("id, turma_id, session_id, status")
    .eq("escola_id", input.escolaId)
    .eq("aluno_id", input.alunoId)
    .eq("session_id", context.anoLetivoId)
    .order("created_at", { ascending: false })
    .limit(1).maybeSingle();
  if (error) throw error;
  if (input.operation === "WRITE") {
    if (context.mode !== "CURRENT") {
      throw new AcademicYearContextError("ACADEMIC_YEAR_CLOSED", 409, "Não é possível criar pedidos num ano letivo encerrado.");
    }
    if (!data || !["ativa", "ativo"].includes(data.status ?? "")) {
      throw new AcademicYearContextError("ACADEMIC_ENTITY_NOT_FOUND", 409, "A matrícula selecionada não está ativa para novos pedidos.");
    }
  }
  return { context, matricula: data };
}
