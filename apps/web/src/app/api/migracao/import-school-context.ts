import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { K12_SECRETARIA_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";

/**
 * Resolve the active school from an explicit, validated request parameter
 * or the server-side selected school; never aggregate a user's memberships.
 * A school relationship alone does not grant a migration-management role.
 */
export async function resolveAuthorizedImportSchool(
  supabase: SupabaseClient<any>,
  request: Request,
  userId: string,
): Promise<{ escolaId: string; error?: never } | { escolaId?: never; error: NextResponse }> {
  const suppliedId = new URL(request.url).searchParams.get("escola_id");
  if (suppliedId !== null && !z.string().uuid().safeParse(suppliedId).success) {
    return { error: NextResponse.json({ error: "Escola inválida." }, { status: 400 }) };
  }
  const escolaId = await resolveEscolaIdForUser(supabase as any, userId, suppliedId);
  if (!escolaId) {
    return { error: NextResponse.json({ error: "Escola não autorizada." }, { status: 403 }) };
  }
  const access = await requireRoleInSchool({
    supabase,
    escolaId,
    roles: [...K12_SECRETARIA_OPERACIONAL_ROLE_GROUP, "admin_secretaria", "diretor"],
  });
  if (access.error) {
    return { error: access.error };
  }
  return { escolaId };
}

/** Validate cursor before composing PostgREST filter grammar. */
export function parseImportHistoryCursor(raw: string | null):
  | { createdAt: string; id: string }
  | null
  | "invalid" {
  if (!raw) return null;
  const parts = raw.split(",");
  if (parts.length !== 2 || !z.string().uuid().safeParse(parts[1]).success) return "invalid";
  const createdAt = parts[0]!;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(createdAt)) {
    return "invalid";
  }
  const parsed = new Date(createdAt);
  if (!Number.isFinite(parsed.getTime())) return "invalid";
  return { createdAt: parsed.toISOString(), id: parts[1]! };
}

export function parseImportHistoryLimit(raw: string | null): number | null {
  if (raw === null) return 30;
  if (!/^\d{1,3}$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 ? Math.min(value, 50) : null;
}
