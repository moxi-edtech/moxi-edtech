import { supabaseServer } from "@/lib/supabase/server";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export async function resolveCurrentEscolaParam() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const metadataEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
  const escolaId = await resolveEscolaIdForUser(
    supabase,
    user.id,
    null,
    metadataEscolaId ? String(metadataEscolaId) : null,
  );

  if (!escolaId) return null;

  const { data } = await supabase
    .from("escolas")
    .select("slug")
    .eq("id", escolaId)
    .maybeSingle();

  return data?.slug ? String(data.slug) : String(escolaId);
}
