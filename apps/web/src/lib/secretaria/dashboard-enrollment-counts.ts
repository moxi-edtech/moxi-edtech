import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DBWithRPC } from "@/types/supabase-augment";
import { getLuandaDayBounds } from "./luanda-day";

// Mantém o mesmo conjunto de estados que a lista nominal
// (secretaria_list_alunos_kf2), sem contar históricos ou anuladas.
const ACTIVE_ENROLLMENT_STATUSES = ["ativo", "ativa", "active"] as const;
/**
 * Totais da Secretaria em tempo real, filtrados por escola e ano letivo.
 * count:exact + head:true evita carregar registos de alunos no dashboard.
 * O join com alunos replica a exclusão de deleted_at da lista nominal.
 * A autorização da chamada é verificada na rota e reforçada pela RLS.
 */
export async function getLiveSecretariaAcademicCounts(
  supabase: SupabaseClient<DBWithRPC>,
  escolaId: string,
  anoLetivo: number | null | undefined,
  anoLetivoId: string | null | undefined,
  now = new Date()
): Promise<{ alunos: number; matriculasHoje: number; turmas: number }> {
  if (!Number.isSafeInteger(anoLetivo) || !anoLetivoId || !anoLetivo) {
    return { alunos: 0, matriculasHoje: 0, turmas: 0 };
  }

  const { startUtc, endUtc } = getLuandaDayBounds(now);
  const countActive = () =>
    supabase
      .from("matriculas")
      .select("id, alunos!inner(id)", { count: "exact", head: true })
      .eq("escola_id", escolaId)
      .eq("ano_letivo", anoLetivo)
      .in("status", [...ACTIVE_ENROLLMENT_STATUSES])
      .is("alunos.deleted_at", null);

  const [total, today, classes] = await Promise.all([
    countActive(),
    countActive().gte("created_at", startUtc).lt("created_at", endUtc),
    supabase
      .from("turmas")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", escolaId)
      .eq("ano_letivo_id", anoLetivoId),
  ]);

  if (total.error) throw total.error;
  if (today.error) throw today.error;
  if (classes.error) throw classes.error;
  if (total.count === null || today.count === null || classes.count === null) {
    throw new Error("Contagem do dashboard indisponível");
  }

  return { alunos: total.count, matriculasHoje: today.count, turmas: classes.count };
}
