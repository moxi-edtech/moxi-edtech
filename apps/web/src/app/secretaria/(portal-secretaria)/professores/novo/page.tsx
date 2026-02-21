import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await supabaseServer();
  const { data: sess } = await s.auth.getUser();
  const user = sess?.user;

  if (!user) {
    return redirect("/conta/login");
  }

  const { data: prof } = await s
    .from("profiles")
    .select("escola_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const escolaId = (prof as { escola_id?: string | null } | null)?.escola_id ?? null;

  if (!escolaId) {
    return redirect("/secretaria");
  }

  return redirect(`/escola/${escolaId}/professores?tab=adicionar`);
}
