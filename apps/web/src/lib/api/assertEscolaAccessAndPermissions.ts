import type { SupabaseClient } from "@supabase/supabase-js";
import { hasPermission, type Permission } from "@/lib/permissions";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

type Client = SupabaseClient<Database>;

type AccessOk = {
  ok: true;
  escolaId: string;
  profileRole: string | null;
  escolaPapel: string | null;
};

type AccessFail = {
  ok: false;
  status: 401 | 403;
  error: string;
  code: string;
};

export type EscolaAccessResult = AccessOk | AccessFail;

type Options = {
  client: Client;
  userId: string;
  requestedEscolaId: string;
  requiredPermissions?: Permission[];
};

export async function assertEscolaAccessAndPermissions({
  client,
  userId,
  requestedEscolaId,
  requiredPermissions = [],
}: Options): Promise<EscolaAccessResult> {
  const escolaId = await resolveEscolaIdForUser(client, userId, requestedEscolaId);
  if (!escolaId) {
    return {
      ok: false,
      status: 403,
      error: "Sem permissão",
      code: "ESCOLA_ACCESS_DENIED",
    };
  }

  const [{ data: profileRows }, { data: vincRows }, { data: adminRows }] = await Promise.all([
    client
      .from("profiles")
      .select("role, escola_id, current_escola_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    client
      .from("escola_users")
      .select("papel, role, created_at")
      .eq("escola_id", escolaId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    client
      .from("escola_administradores")
      .select("user_id")
      .eq("escola_id", escolaId)
      .eq("user_id", userId)
      .limit(1),
  ]);

  const profileRow = (profileRows && profileRows.length > 0 ? profileRows[0] : null) as
    | { role?: string | null; escola_id?: string | null; current_escola_id?: string | null }
    | null;
  const profileRole = profileRow?.role ? String(profileRow.role) : null;
  const profileEscolaId =
    profileRow?.current_escola_id ?? profileRow?.escola_id ?? null;
  const hasProfileLink = Boolean(profileEscolaId && String(profileEscolaId) === escolaId);

  const vincRow = (vincRows && vincRows.length > 0 ? vincRows[0] : null) as
    | { papel?: string | null; role?: string | null }
    | null;
  const escolaPapel = vincRow?.papel ?? vincRow?.role ?? null;
  const hasEscolaLink = Array.isArray(vincRows) && vincRows.length > 0;
  const hasAdminLink = Array.isArray(adminRows) && adminRows.length > 0;

  const isGlobalAdmin = profileRole === "super_admin" || profileRole === "global_admin";
  const hasBasicLink = isGlobalAdmin || hasProfileLink || hasEscolaLink || hasAdminLink;
  if (!hasBasicLink) {
    return {
      ok: false,
      status: 403,
      error: "Sem permissão",
      code: "ESCOLA_LINK_NOT_FOUND",
    };
  }

  if (requiredPermissions.length > 0 && !isGlobalAdmin) {
    const canByProfile = profileRole
      ? requiredPermissions.every((perm) => hasPermission(profileRole, perm))
      : false;
    const canByPapel = escolaPapel
      ? requiredPermissions.every((perm) => hasPermission(escolaPapel, perm))
      : false;
    const canByAdminTable = hasAdminLink;

    if (!(canByProfile || canByPapel || canByAdminTable)) {
      return {
        ok: false,
        status: 403,
        error: "Sem permissão",
        code: "PERMISSION_DENIED",
      };
    }
  }

  return {
    ok: true,
    escolaId,
    profileRole,
    escolaPapel: escolaPapel ? String(escolaPapel) : null,
  };
}

