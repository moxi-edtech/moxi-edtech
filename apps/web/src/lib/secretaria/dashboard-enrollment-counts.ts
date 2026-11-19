import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DBWithRPC } from "@/types/supabase-augment";

// Mantém o mesmo conjunto de estados que a lista nominal
// (secretaria_list_alunos_kf2), sem contar históricos ou anuladas.
const ACTIVE_ENROLLMENT_STATUSES = ["ativo", "ativa", "active"] as const;
const LUANDA_TIMEZONE = "Africa/Luanda";

/**
 * Limites UTC para o dia civil em Angola (UTC+01, sem horário de verão).
 * Não depende do timezone do servidor Vercel nem do navegador.
 */
export function getLuandaDayBounds(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LUANDA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  if (!year || !month || !day) throw new Error("Não foi possível obter a data em Angola");

  const startMs = Date.parse(`${year}-${month}-${day}T00:00:00+01:00`);
  if (!Number.isFinite(startMs)) throw new Error("Dia de Angola inválido");

  return {
    startUtc: new Date(startMs).toISOString(),
    endUtc: new Date(startMs + 86_400_000).toISOString(),
  };
}

/**
 * Totais da Secretaria em tempo real, filtrados por escola e ano letivo.
 * count:exact + head:true evita carregar registos de alunos no dashboard.
 * O join com alunos replica a exclusão de deleted_at da lista nominal.
 * A autorização da chamada é verificada na rota e reforçada pela RLS.
 */
export async function getLiveSecretariaEnrollmentCounts(
  supabase: SupabaseClient<DBWithRPC>,
  escolaId: string,
  anoLetivo: number | null | undefined,
  now = new Date()
): Promise<{ alunos: number; matriculasHoje: number }> {
  if (!Number.isSafeInteger(anoLetivo) || !anoLetivo) {
    return { alunos: 0, matriculasHoje: 0 };
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

  const [total, today] = await Promise.all([
    countActive(),
    countActive().gte("created_at", startUtc).lt("created_at", endUtc),
  ]);

  if (total.error) throw total.error;
  if (today.error) throw today.error;
  if (total.count === null || today.count === null) {
    throw new Error("Contagem de matrículas indisponível");
  }

  return { alunos: total.count, matriculasHoje: today.count };
}
