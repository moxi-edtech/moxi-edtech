import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { resolveAcademicYearContext, AcademicYearContextError } from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
    const { id: turmaId } = await ctx.params;
    const academicContext = await resolveAcademicYearContext(supabase, { userId: auth.user.id, requestedAcademicYearId: new URL(req.url).searchParams.get("ano_letivo_id"), operation: "READ" });
    const { data: professor } = await supabase.from("professores").select("id").eq("escola_id", escolaId).eq("profile_id", auth.user.id).maybeSingle();
    if (!professor?.id) return NextResponse.json({ ok: false, error: "Professor não encontrado" }, { status: 403 });
    const { data: assignment } = await supabase.from("turma_disciplinas_professores").select("id").eq("escola_id", escolaId).eq("professor_id", professor.id).eq("turma_id", turmaId).limit(1).maybeSingle();
    if (!assignment?.id) return NextResponse.json({ ok: false, error: "Você não está associado a esta turma" }, { status: 403 });
    const { data: turma } = await supabase.from("turmas").select("id, nome, session_id").eq("id", turmaId).eq("escola_id", escolaId).eq("session_id", academicContext.anoLetivoId).maybeSingle();
    if (!turma) return NextResponse.json({ ok: false, error: "Turma não encontrada no ano letivo ativo" }, { status: 404 });
    const { data: versao } = await supabase.from("horario_versoes").select("id, publicado_em").eq("escola_id", escolaId).eq("turma_id", turmaId).eq("status", "publicada").order("publicado_em", { ascending: false }).limit(1).maybeSingle();
    if (!versao) return NextResponse.json({ ok: true, context: academicContext, turma, publicado: false, items: [] });
    const { data: quadro, error } = await supabase.from("quadro_horarios").select("slot_id, disciplina_id, professor_id, sala_id").eq("escola_id", escolaId).eq("turma_id", turmaId).eq("versao_id", versao.id).limit(100);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    const slotIds = [...new Set((quadro ?? []).map((row: any) => row.slot_id).filter(Boolean))];
    const disciplinaIds = [...new Set((quadro ?? []).map((row: any) => row.disciplina_id).filter(Boolean))];
    const salaIds = [...new Set((quadro ?? []).map((row: any) => row.sala_id).filter(Boolean))];
    const [{ data: slots }, { data: disciplinas }, { data: salas }] = await Promise.all([
      supabase.from("horario_slots").select("id, dia_semana, ordem, inicio, fim, is_intervalo").eq("escola_id", escolaId).in("id", slotIds),
      supabase.from("disciplinas_catalogo").select("id, nome").eq("escola_id", escolaId).in("id", disciplinaIds),
      salaIds.length ? supabase.from("salas").select("id, nome").eq("escola_id", escolaId).in("id", salaIds) : Promise.resolve({ data: [] }),
    ]);
    const slotMap = new Map((slots ?? []).map((row: any) => [row.id, row]));
    const disciplinaMap = new Map((disciplinas ?? []).map((row: any) => [row.id, row.nome]));
    const salaMap = new Map((salas ?? []).map((row: any) => [row.id, row.nome]));
    const items = (quadro ?? []).map((row: any) => { const slot = slotMap.get(row.slot_id); return slot && !slot.is_intervalo ? { ...row, ...slot, disciplina_nome: disciplinaMap.get(row.disciplina_id) ?? "Disciplina", sala_nome: row.sala_id ? salaMap.get(row.sala_id) ?? null : null } : null; }).filter(Boolean).sort((a: any, b: any) => Number(a.dia_semana) - Number(b.dia_semana) || String(a.inicio).localeCompare(String(b.inicio)));
    return NextResponse.json({ ok: true, context: academicContext, turma, publicado: true, publicado_em: versao.publicado_em, items });
  } catch (cause) {
    if (cause instanceof AcademicYearContextError) return NextResponse.json({ ok: false, error: cause.code, message: cause.message }, { status: cause.status });
    return NextResponse.json({ ok: false, error: cause instanceof Error ? cause.message : String(cause) }, { status: 500 });
  }
}
