import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { authorizePedagogicalManage } from "@/lib/escola/disciplinas";
import { timetablePublicationState } from "@/lib/horarios/timetable-publication-state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Read only. Unlike the legacy turma selector, this endpoint returns the
// complete active-year roster and never creates a draft to calculate status.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const { id } = await ctx.params;
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id, id, id);
  if (!escolaId || !(await authorizePedagogicalManage(supabase, escolaId, auth.user.id)).allowed)
    return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
  const { data: year, error: yearError } = await supabase.from("anos_letivos")
    .select("id, ano, data_inicio, data_fim").eq("escola_id", escolaId).eq("ativo", true).maybeSingle();
  if (yearError || !year) return NextResponse.json({ ok: false, error: "Não foi possível identificar o ano lectivo activo." }, { status: 409 });
  const { data: turmas, count, error } = await supabase.from("turmas")
    .select("id, nome, turma_codigo, turma_code, turno, sala, classe_id, curso_id, ano_letivo_id, ano_letivo, session_id, classe:classe_id(nome), curso:curso_id(nome)", { count: "exact" })
    .eq("escola_id", escolaId).eq("ano_letivo_id", year.id).eq("status_validacao", "ativo")
    .order("nome").order("id").limit(1000);
  if (error || count !== (turmas || []).length)
    return NextResponse.json({ ok: false, error: "Não foi possível carregar todas as turmas." }, { status: 503 });
  const versionsByTurma = new Map<string, Array<{id: string; status: string}>>();
  const ids = (turmas || []).map((t: {id: string}) => t.id);
  for (let i = 0; i < ids.length; i += 50) {
    const { data: versions, count: versionCount, error: versionError } = await supabase.from("horario_versoes")
      .select("id, turma_id, status", { count: "exact" })
      .eq("escola_id", escolaId).in("turma_id", ids.slice(i,i+50))
      .in("status", ["draft","publicada"]).order("id").limit(1000);
    if (versionError || versionCount !== (versions || []).length)
      return NextResponse.json({ ok: false, error: "Não foi possível consultar todos os estados de publicação." }, { status: 503 });
    for (const version of versions || []) {
      const rows = versionsByTurma.get(version.turma_id) || [];
      rows.push(version);
      versionsByTurma.set(version.turma_id, rows);
    }
  }
  const items = (turmas || []).map((t: any) => ({
    ...t, turma_nome: t.nome,
    classe: Array.isArray(t.classe) ? t.classe[0] ?? null : t.classe,
    curso: Array.isArray(t.curso) ? t.curso[0] ?? null : t.curso,
    horario_status: timetablePublicationState(versionsByTurma.get(t.id) || []),
  }));
  return NextResponse.json({ ok: true, items, year }, { headers: { "Cache-Control": "no-store" } });
}
