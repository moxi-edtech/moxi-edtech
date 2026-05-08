// apps/web/src/app/secretaria/balcao/page.tsx
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { notFound } from "next/navigation";
import BalcaoPageClient from "./BalcaoPageClient";

export default async function BalcaoPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return notFound();
  }

  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) {
    return notFound();
  }

  const { data: escolaInfo } = await supabase
    .from("escolas")
    .select("slug")
    .eq("id", escolaId)
    .maybeSingle();
  const escolaParam = escolaInfo?.slug ? String(escolaInfo.slug) : escolaId;

  return <BalcaoPageClient escolaId={escolaId} escolaParam={escolaParam} />;
}
