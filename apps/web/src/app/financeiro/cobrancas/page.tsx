import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = 'force-dynamic';

export default async function CobrancasRedirectPage() {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  
  let escolaId: string | null = null;
  if (user) {
    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    escolaId = await resolveEscolaIdForUser(
      supabase as Parameters<typeof resolveEscolaIdForUser>[0],
      user.id,
      null,
      metaEscolaId ? String(metaEscolaId) : null
    );
  }

  if (escolaId) {
    redirect(`/escola/${escolaId}/financeiro/radar`);
  }

  redirect("/");
}
