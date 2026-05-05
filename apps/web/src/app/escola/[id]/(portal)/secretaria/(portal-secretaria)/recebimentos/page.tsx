import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import PagamentosPendentesWindow from "@/components/secretaria/PagamentosPendentesWindow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RecebimentosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await params;
  const supabase = await supabaseServer();
  const { data: session } = await supabase.auth.getUser();
  const user = session?.user;

  if (!user) {
    redirect("/redirect");
  }

  const resolvedEscolaId = await resolveEscolaIdForUser(supabase, user.id, escolaId);
  if (!resolvedEscolaId) {
    redirect("/redirect");
  }

  return <PagamentosPendentesWindow />;
}
