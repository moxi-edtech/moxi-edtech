import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import PagamentosPendentesWindow from "@/components/secretaria/PagamentosPendentesWindow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RecebimentosPage() {
  const supabase = await supabaseServer();
  const { data: session } = await supabase.auth.getUser();
  const user = session?.user;

  if (!user) {
    redirect("/redirect");
  }

  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) {
    redirect("/redirect");
  }

  return <PagamentosPendentesWindow />;
}
