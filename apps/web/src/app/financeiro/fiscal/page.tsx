import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = 'force-dynamic';

export default async function FiscalRedirectPage({ searchParams }) {
  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  
  let escolaId: string | null = null;
  if (user) {
    const metaEscolaId = (user.app_metadata as any)?.escola_id ?? null;
    escolaId = await resolveEscolaIdForUser(supabase as any, user.id, null, metaEscolaId);
  }

  if (escolaId) {
    const q = new URLSearchParams(await searchParams).toString();
    redirect(`/escola/${escolaId}/financeiro/fiscal${q ? '?' + q : ''}`);
  }

  redirect("/");
}
