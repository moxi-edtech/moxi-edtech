/**
 * KLASSE — Secretaria / Alunos / page.tsx
 *
 * Substitui AlunosListClient como page.tsx.
 *
 * Padrão: Server Component fino que resolve escolaId no servidor
 * e passa para o Client Component — consistente com resolveEscolaIdForUser
 * e com o resto do sistema (fecha o blocker de contrato multi-tenant).
 */

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import AlunosSecretariaPage from "@/components/secretaria/AlunosSecretariaPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) redirect("/login");

  return <AlunosSecretariaPage />;
}
