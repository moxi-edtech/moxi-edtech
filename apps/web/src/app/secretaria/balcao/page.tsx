// apps/web/src/app/secretaria/balcao/page.tsx
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { notFound, redirect } from "next/navigation";

export default async function BalcaoPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Redirecionar para login ou mostrar erro
    // Por simplicidade aqui, apenas não encontrado
    return notFound();
  }

  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) {
    return notFound(); // Ou exibir erro de escola
  }

  const { data: escolaInfo } = await supabase
    .from("escolas")
    .select("slug")
    .eq("id", escolaId)
    .maybeSingle();
  const escolaParam = escolaInfo?.slug ? String(escolaInfo.slug) : escolaId;

  return redirect(`/escola/${escolaParam}/secretaria`);
}
