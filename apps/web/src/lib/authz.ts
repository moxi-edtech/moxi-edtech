// apps/web/src/lib/authz.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export type Role =
  | "secretaria"
  | "admin"
  | "super_admin"
  | "financeiro"
  | "admin_escola"
  | "staff_admin";

interface RequireRoleInSchoolParams {
  supabase: SupabaseClient;
  escolaId: string;
  roles: Role[];
}

/**
 * KLASSE AuthZ (SSOT = escola_users)
 * - NÃO depende de profiles
 * - Super admin bypass via RPC (check_super_admin_role) ou via escola_users.papel
 */
export async function requireRoleInSchool({
  supabase,
  escolaId,
  roles,
}: RequireRoleInSchoolParams): Promise<{ user: any; error?: NextResponse }> {
  const { data, error: authError } = await supabase.auth.getUser();
  const user = data?.user ?? null;

  if (authError || !user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  // 1) Super Admin bypass (preferível: função no banco)
  // Se você tem check_super_admin_role(), use-a. Se não tiver, remove esse bloco.
  try {
    const { data: isSa, error: saErr } = await supabase.rpc("check_super_admin_role");
    if (!saErr && isSa === true) return { user };
  } catch {
    // ignore: mantém fluxo por escola_users
  }

  // 2) Membership + role in school (fonte da verdade)
  const { data: membership, error: mErr } = await supabase
    .from("escola_users")
    // Se sua coluna for "role" e não "papel", troque aqui:
    .select("escola_id, papel, user_id")
    .eq("escola_id", escolaId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (mErr) {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (!membership) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Forbidden", reason: "not_member_of_school" },
        { status: 403 }
      ),
    };
  }

  // Se você usa "papel" no DB, ele chega como string.
  // Validamos por whitelist sem confiar no client.
  const papel = membership.papel as Role | string;

  // Se quiser manter super_admin como papel em escola_users, suporta aqui também:
  if (papel === "super_admin") return { user };

  if (!roles.includes(papel as Role)) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Forbidden", reason: "insufficient_role", papel },
        { status: 403 }
      ),
    };
  }

  return { user };
}