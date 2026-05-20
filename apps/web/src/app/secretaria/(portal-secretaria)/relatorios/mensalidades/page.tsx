import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await supabaseServer();
  const { data: sess } = await s.auth.getUser();
  const user = sess?.user;
  const escolaId = user ? await resolveEscolaIdForUser(s, user.id) : null;

  if (!escolaId) {
    redirect("/secretaria/relatorios");
  }

  redirect(`/escola/${escolaId}/secretaria/relatorios/propinas`);
}
