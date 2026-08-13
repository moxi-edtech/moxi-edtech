import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { loadAulaRelatorio } from "@/lib/operacoes/aulaRelatorio";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const ROLES = ["secretaria", "secretaria_financeiro", "admin_financeiro", "admin_secretaria", "admin_escola", "admin", "staff_admin", "diretor"] as const;

export async function GET(_req: Request, ctx: { params: Promise<{ aulaId: string }> }) {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: [...ROLES] });
  if (authz.error) return authz.error;
  const { aulaId } = await ctx.params;
  try {
    const report = await loadAulaRelatorio(supabase, escolaId, aulaId);
    if (!report) return NextResponse.json({ ok: false, error: "Aula não encontrada" }, { status: 404 });
    return NextResponse.json({ ok: true, report });
  } catch (cause) {
    return NextResponse.json({ ok: false, error: cause instanceof Error ? cause.message : String(cause) }, { status: 500 });
  }
}
