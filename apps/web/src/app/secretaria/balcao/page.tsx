// apps/web/src/app/secretaria/balcao/page.tsx
import BalcaoAtendimento from "@/components/secretaria/BalcaoAtendimento";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { notFound } from "next/navigation";

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
  
  // Passar o escolaId para o componente BalcaoAtendimento
  return <BalcaoAtendimento escolaId={escolaId} />;
}
