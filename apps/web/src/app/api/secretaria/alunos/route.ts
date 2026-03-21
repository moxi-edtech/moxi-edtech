// @kf2 allow-scan
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { listAllAlunos, listAlunos, parseAlunoListFilters } from "@/lib/services/alunos.service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// Lista alunos (portal secretaria)
// Agora trazendo numero_processo_login via relacionamento alunos -> profiles
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
    const includeResumo = filters.includeResumo;

    if (filters.orderBy === "nome_asc") {
      const allItems = await listAllAlunos(supabase, escolaId, filters, {
        includeFinanceiro: true,
        includeResumo,
      });
      const sorted = [...allItems].sort((a, b) => {
        const nomeA = (a.nome ?? "").toLocaleLowerCase("pt-AO");
        const nomeB = (b.nome ?? "").toLocaleLowerCase("pt-AO");
        const compare = nomeA.localeCompare(nomeB, "pt-AO", { sensitivity: "base" });
        if (compare !== 0) return compare;
        return (a.id ?? "").localeCompare(b.id ?? "");
      });
      const limit = Math.min(filters.limit ?? 20, 50);
      const pageIndex = Math.max(filters.page ?? 1, 1);
      const start = (pageIndex - 1) * limit;
      const end = start + limit;
      const items = sorted.slice(start, end);
      const hasMore = end < sorted.length;

      return NextResponse.json({
        ok: true,
        data: items,
        items,
        total: sorted.length,
        page: {
          limit,
          offset: start,
          nextOffset: hasMore ? end : null,
          hasMore,
          nextCursor: null,
          total: sorted.length,
        },
      });
    }

    const { items, page } = await listAlunos(supabase, escolaId, filters, {
      includeFinanceiro: true,
      includeResumo,
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
