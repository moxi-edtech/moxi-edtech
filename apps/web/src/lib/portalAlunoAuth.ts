import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export async function resolveAuthorizedStudentIds(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  escolaId: string;
  userEmail?: string | null;
}) {
  const { supabase, userId, escolaId, userEmail } = params;

  const { data: directRows } = await supabase
    .from("alunos")
    .select("id")
    .eq("profile_id", userId)
    .eq("escola_id", escolaId)
    .limit(50);

  const directIds = (directRows ?? []).map((r) => r.id);

  let linkedIds: string[] = [];
  if (userEmail) {
    const { data: encarregado } = await supabase
      .from("encarregados")
      .select("id")
      .eq("escola_id", escolaId)
      .ilike("email", userEmail)
      .limit(1)
      .maybeSingle();

    if (encarregado?.id) {
      const { data: links } = await supabase
        .from("aluno_encarregados")
        .select("aluno_id")
        .eq("escola_id", escolaId)
        .eq("encarregado_id", encarregado.id)
        .limit(100);
      linkedIds = (links ?? []).map((l) => l.aluno_id);
    }
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
