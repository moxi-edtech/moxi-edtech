import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export type PortalRole = "admin" | "secretaria" | "financeiro" | "professor" | "aluno";

const PORTAL_ALLOWED_ROLES: Record<PortalRole, string[]> = {
  admin: ["admin", "admin_escola", "staff_admin", "super_admin", "global_admin"],
  secretaria: [
    "secretaria",
    "secretaria_financeiro",
    "admin_financeiro",
    "admin",
    "admin_escola",
    "staff_admin",
    "super_admin",
    "global_admin",
  ],
  financeiro: [
    "financeiro",
    "secretaria_financeiro",
    "admin_financeiro",
    "admin",
    "admin_escola",
    "staff_admin",
    "super_admin",
    "global_admin",
  ],
  professor: ["professor", "admin", "admin_escola", "staff_admin", "super_admin", "global_admin"],
  aluno: ["aluno", "encarregado"],
};

type PortalAccessResult =
  | { ok: true; role: string; escolaId: string | null }
  | { ok: false; status: number; error: string };

export async function assertPortalAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
  portal: PortalRole,
  escolaIdFromPath?: string | null
): Promise<PortalAccessResult> {
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role, escola_id, current_escola_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (profileErr) {
    return { ok: false, status: 400, error: profileErr.message };
  }

  const role = String(profile?.role ?? "");
  const allowed = PORTAL_ALLOWED_ROLES[portal] ?? [];
  if (!allowed.includes(role)) {
    return { ok: false, status: 403, error: "Sem permissão" };
  }

  const escolaId = profile?.current_escola_id ?? profile?.escola_id ?? null;
  if (escolaIdFromPath && escolaId && String(escolaIdFromPath) !== String(escolaId)) {
    return { ok: false, status: 403, error: "Escola não corresponde ao perfil" };
  }

  return { ok: true, role, escolaId };
}
