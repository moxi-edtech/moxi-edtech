// @kf2 allow-scan
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { listAlunos, parseAlunoListFilters } from "@/lib/services/alunos.service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Lista alunos (portal secretaria)
// Agora trazendo numero_login via relacionamento alunos -> profiles
export async function GET(req: Request) {
  try {
    const supabase = await createRouteClient();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }
    const user = userRes.user;

    const url = new URL(req.url);
    const requestedEscolaId = url.searchParams.get("escolaId") || url.searchParams.get("escola_id");
    const escolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Usuário não vinculado a nenhuma escola" }, { status: 403 });
    }

    const { error: roleError } = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: ["secretaria", "admin", "admin_escola", "staff_admin"],
    });
    if (roleError) return roleError;

    const filters = parseAlunoListFilters(url);
    const { items, page } = await listAlunos(supabase, escolaId, filters, {
      includeFinanceiro: true,
      includeResumo: filters.includeResumo,
    });

    return NextResponse.json({
      ok: true,
      data: items,
      items,
      total: items.length,
      page: {
        ...page,
        total: items.length,
      },
    });
  } catch (e: any) {
    console.error("[alunos list error]", e);
    return NextResponse.json({ ok: false, error: e.message || "Erro desconhecido" }, { status: 500 });
  }
}
