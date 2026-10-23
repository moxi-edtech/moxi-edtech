import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/** P0: no canonical user-polo-enrollment mapping exists in the installed schema.
 * An absent polo parameter MUST NOT give a restricted operator whole-school access.
 */
const WHOLE_SCHOOL_ROLES = new Set(["admin", "admin_escola", "staff_admin", "diretor"]);

export function isCommandCenterWholeSchoolRole(role: unknown): boolean {
  return typeof role === "string" && WHOLE_SCHOOL_ROLES.has(role.trim().toLowerCase());
}
export function hasRequestedPoloScope(url: string): boolean {
  const params = new URL(url).searchParams;
  return params.has("poloId") || params.has("polo_id");
}
function deny(code: string) {
  return NextResponse.json({
    ok: false, code,
    error: "Consulta indisponível sem autorização institucional ou vínculo canónico de polo.",
  }, {status: 403, headers: {"Cache-Control": "private, no-store"}});
}

/** Must run after auth, school and K12 role checks and before reading records.
 * Live membership only; ignore caller-provided role, user_metadata and cached role.
 */
export async function requireCommandCenterSchoolWideAccess(
  supabase: SupabaseClient, userId: string, escolaId: string, req: NextRequest,
): Promise<NextResponse | null> {
  // An explicit (even blank/invalid) polo cannot be scoped by this schema.
  if (hasRequestedPoloScope(req.url)) return deny("POLO_SCOPE_UNAVAILABLE");
  const {data: member, error} = await supabase.from("escola_users")
    .select("papel").eq("escola_id", escolaId).eq("user_id", userId).maybeSingle();
  if (!error && member && isCommandCenterWholeSchoolRole(member.papel)) return null;

  // Only the trusted DB-verified global super-admin exception is retained.
  const {data: isSuperAdmin, error: saError} = await supabase.rpc("check_super_admin_role");
  if (!saError && isSuperAdmin === true) return null;
  return deny("POLO_SCOPE_NOT_CANONICAL");
}
