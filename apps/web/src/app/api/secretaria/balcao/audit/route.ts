import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 20);
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 20;
    const alunoId = searchParams.get("alunoId");
    const matriculaId = searchParams.get("matriculaId");

    let query = supabase
      .from("audit_logs")
      .select("id, created_at, action, entity, entity_id, portal, details, actor_id")
      .eq("escola_id", escolaId)
      .eq("actor_id", user.id)
      .order("created_at", { ascending: false })
      .limit(safeLimit);

    const orFilters: string[] = [];
    if (alunoId) orFilters.push(`details->>aluno_id.eq.${alunoId}`);
    if (matriculaId) orFilters.push(`details->>matricula_id.eq.${matriculaId}`);
    if (orFilters.length > 0) {
      query = query.or(orFilters.join(","));
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, logs: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
