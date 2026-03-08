import { supabaseServer } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import { resolveEscolaParam } from "@/lib/tenant/resolveEscolaParam";
import { isSuperAdminRole } from "./requireSuperAdminAccess";

/**
 * Utilitário Server-Side para garantir que a escola está activa.
 * Redireciona para /escola/suspensa se estiver suspensa.
 * Ignora o bloqueio se o utilizador for Super Admin.
 */
export async function requireSchoolActive(escolaId: string) {
  const supabase = await supabaseServer();
  
  // 1. Verificar se o utilizador é Super Admin
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    
    if (isSuperAdminRole(profile?.role)) {
      return { status: 'ativa', isSuperAdmin: true };
    }
  }

  // 2. Verificar Status da Escola
  const resolved = await resolveEscolaParam(supabase as any, escolaId);
  if (!resolved.escolaId && resolved.paramType === "slug") {
    return { status: 'not_found' };
  }

  const resolvedId = resolved.escolaId ?? escolaId;

  const { data: escola, error } = await supabase
    .from("escolas")
    .select("status")
    .eq("id", resolvedId)
    .single();

  if (error || !escola) return { status: 'not_found' };

  if (escola.status === 'suspensa') {
    redirect('/escola/suspensa');
  }

  return { status: escola.status, isSuperAdmin: false };
}
