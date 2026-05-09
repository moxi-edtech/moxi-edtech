import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = 'force-dynamic';

export default async function FinanceiroRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<{ aluno?: string; view?: string }>;
}) {
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
    const p = (searchParams ? await searchParams : {}) as Record<string, string>;
    const qp = new URLSearchParams(p);
    const query = qp.toString();
    redirect(`/escola/${escolaId}/financeiro${query ? `?${query}` : ''}`);
  }

  // Fallback if no school found - maybe show an error or redirect to home
  redirect("/");
}
