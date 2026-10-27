import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export async function resolveAuthorizedStudentIds(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  escolaId: string;
  userEmail?: string | null;
}) {
  const { supabase, userId, escolaId, userEmail } = params;

  // A associação direta e a identidade do encarregado não dependem entre si.
  // Mantemos ambas no Supabase com RLS; nenhum vínculo é reutilizado entre pedidos.
  const directRowsPromise = supabase
    .from("alunos")
    .select("id")
    .eq("profile_id", userId)
    .eq("escola_id", escolaId)
    .limit(50);

  const normalizedEmail = userEmail?.trim();
  const encarregadoPromise = normalizedEmail
    ? supabase
        .from("encarregados")
        .select("id")
        .eq("escola_id", escolaId)
        .eq("email", normalizedEmail)
        .limit(1)
        .maybeSingle()
    : Promise.resolve({ data: null });

  const [directResult, encarregadoResult] = await Promise.all([
    directRowsPromise,
    encarregadoPromise,
  ]);
  const directIds = (directResult.data ?? []).map((r) => r.id);

  let linkedIds: string[] = [];
  const encarregadoId = encarregadoResult.data?.id;
  if (encarregadoId) {
    const { data: links } = await supabase
      .from("aluno_encarregados")
      .select("aluno_id")
      .eq("escola_id", escolaId)
      .eq("encarregado_id", encarregadoId)
      .limit(100);
    linkedIds = (links ?? []).map((link) => link.aluno_id);
  }

  const unique = Array.from(new Set([...directIds, ...linkedIds]));
  return unique;
}

export function resolveSelectedStudentId(params: {
  selectedId: string | null;
  authorizedIds: string[];
  fallbackId: string | null;
}) {
  const { selectedId, authorizedIds, fallbackId } = params;
  if (selectedId && authorizedIds.includes(selectedId)) return selectedId;
  if (fallbackId && authorizedIds.includes(fallbackId)) return fallbackId;
  return authorizedIds[0] ?? null;
}
