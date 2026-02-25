import { NextRequest, NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { listAlunos, parseAlunoListFilters } from "@/lib/services/alunos.service";
import type { Database } from "~types/supabase";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await ctx.params;
  try {
    const s = await supabaseServerTyped<Database>();
    const { error: roleError } = await requireRoleInSchool({
      supabase: s,
      escolaId,
      roles: ["admin", "admin_escola", "staff_admin"],
    });
    if (roleError) return roleError;

    const { data: userRes } = await s.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const resolvedEscolaId = await resolveEscolaIdForUser(s, user.id, escolaId);
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const url = new URL(req.url);
    const filters = parseAlunoListFilters(url);
    const { items, page } = await listAlunos(s, escolaId, filters, {
      includeFinanceiro: true,
      includeResumo: true,
    });

    return NextResponse.json({ ok: true, items, next_cursor: page.nextCursor ? `${page.nextCursor.created_at},${page.nextCursor.id}` : null });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
