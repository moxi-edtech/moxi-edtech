import { NextRequest, NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { K12_ADMIN_SECRETARIA_ROLE_GROUP } from "@/lib/roles";
import { listAllAlunos, listAlunos, parseAlunoListFilters } from "@/lib/services/alunos.service";
import type { Database } from "~types/supabase";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await ctx.params;
  try {
    const s = await supabaseServerTyped<Database>();
    const { data: userRes } = await s.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const resolvedEscolaId = await resolveEscolaIdForUser(s, user.id, escolaId);
    if (!resolvedEscolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const { error: roleError } = await requireRoleInSchool({
      supabase: s,
      escolaId: resolvedEscolaId,
      roles: [...K12_ADMIN_SECRETARIA_ROLE_GROUP],
    });
    if (roleError) return roleError;

    const url = new URL(req.url);
    const filters = parseAlunoListFilters(url);

    if (filters.orderBy === "nome_asc") {
      const allItems = await listAllAlunos(s, resolvedEscolaId, filters, {
        includeFinanceiro: true,
        includeResumo: true,
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
        items,
        next_cursor: null,
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

    const { items, page } = await listAlunos(s, resolvedEscolaId, filters, {
      includeFinanceiro: true,
      includeResumo: true,
    });

    return NextResponse.json({ ok: true, items, next_cursor: page.nextCursor ? `${page.nextCursor.created_at},${page.nextCursor.id}` : null });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
