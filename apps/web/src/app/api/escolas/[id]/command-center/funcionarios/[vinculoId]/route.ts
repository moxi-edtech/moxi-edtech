import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createRouteClient } from "@/lib/supabase/route-client";
import { requireRoleInSchool } from "@/lib/authz";
import {
  isCommandCenterWholeSchoolRole,
  requireCommandCenterSchoolWideAccess,
} from "@/lib/command-center/school-wide-scope";
import { withExplorerObservability } from "@/lib/command-center/observability";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  escolaId: z.string().uuid(),
  vinculoId: z.string().uuid(),
});

/**
 * Employee results from search_global_entities contain escola_users.id,
 * NOT profiles.user_id or professores.id. Read the exact school membership
 * and then independently re-authorize it. Never trust a search label/role.
 *
 * Read-only, minimum data. Sensitive contacts, documents, login activity,
 * credentials and personnel records are deliberately excluded.
 */
async function readFuncionario(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; vinculoId: string }> },
) {
  const { id, vinculoId } = await params;
  const parsed = paramsSchema.safeParse({ escolaId: id, vinculoId });
  if (!parsed.success) return NextResponse.json(
    { ok: false }, { status: 400 },
  );

  const supabase = await createRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const escolaId = await resolveEscolaIdForUser(supabase, user.id, parsed.data.escolaId);
  if (!escolaId) return NextResponse.json({ ok: false }, { status: 403 });

  const authz = await requireRoleInSchool({
    supabase, escolaId, productContext: "k12",
    roles: [
      "admin", "admin_escola", "staff_admin", "diretor",
      "secretaria", "admin_secretaria", "secretaria_financeiro",
      "admin_financeiro", "financeiro",
    ],
  });
  if (authz.error) return authz.error;

  // No cross-polo staff records until membership-to-polo scoping is canonical.
  const scopeError = await requireCommandCenterSchoolWideAccess(supabase, user.id, escolaId, req);
  if (scopeError) return scopeError;

  const { data: member, error: memberError } = await supabase
    .from("escola_users")
    .select("id, user_id, papel, role")
    .eq("escola_id", escolaId)
    .eq("id", parsed.data.vinculoId)
    .maybeSingle();
  if (memberError) throw memberError;

  const role = member?.papel ?? member?.role;
  if (!member || !isCommandCenterWholeSchoolRole(role)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("nome, deleted_at")
    .eq("user_id", member.user_id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (profile?.deleted_at) return NextResponse.json({ ok: false }, { status: 404 });

  return NextResponse.json({
    ok: true,
    data: {
      funcionario: {
        id: member.id,
        nome: profile?.nome?.trim() || "Funcionário",
        papel: role,
      },
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; vinculoId: string }> },
) {
  return withExplorerObservability("funcionario", () => readFuncionario(req, context));
}
