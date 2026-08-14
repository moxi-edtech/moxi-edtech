import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return NextResponse.json({ ok: true, items: [] });
  const { data: professor } = await supabase.from("professores").select("id").eq("escola_id", escolaId).eq("profile_id", auth.user.id).maybeSingle();
  if (!professor?.id) return NextResponse.json({ ok: false, error: "Professor não encontrado" }, { status: 403 });
  const from = new URL(req.url).searchParams.get("from") ?? new Date().toISOString().slice(0, 10);
  const { data: aulas, error } = await supabase.from("aulas").select("id, data, slot_id, turma_disciplina_id, inicio_previsto, fim_previsto, status").eq("escola_id", escolaId).eq("professor_id", professor.id).gte("data", from).order("data", { ascending: true }).order("inicio_previsto", { ascending: true, nullsFirst: false }).limit(100);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const rows = (aulas ?? []) as Array<any>;
  const tdIds = Array.from(new Set(rows.map((row) => row.turma_disciplina_id).filter(Boolean)));
  const { data: tdRows } = tdIds.length ? await supabase.from("turma_disciplinas").select("id, turma_id, curso_matriz_id").eq("escola_id", escolaId).in("id", tdIds) : { data: [] };
  const turmaIds = Array.from(new Set((tdRows ?? []).map((row: any) => row.turma_id).filter(Boolean)));
  const matrizIds = Array.from(new Set((tdRows ?? []).map((row: any) => row.curso_matriz_id).filter(Boolean)));
  const [{ data: turmas }, { data: matrizes }] = await Promise.all([
    turmaIds.length ? supabase.from("turmas").select("id, nome").eq("escola_id", escolaId).in("id", turmaIds) : Promise.resolve({ data: [] }),
    matrizIds.length ? supabase.from("curso_matriz").select("id, disciplina_id").eq("escola_id", escolaId).in("id", matrizIds) : Promise.resolve({ data: [] }),
  ]);
  const disciplinaIds = Array.from(new Set((matrizes ?? []).map((row: any) => row.disciplina_id).filter(Boolean)));
  const { data: disciplinas } = disciplinaIds.length ? await supabase.from("disciplinas_catalogo").select("id, nome").eq("escola_id", escolaId).in("id", disciplinaIds) : { data: [] };
  const tdMap = new Map((tdRows ?? []).map((row: any) => [row.id, row]));
  const turmaMap = new Map((turmas ?? []).map((row: any) => [row.id, row.nome]));
  const matrizMap = new Map((matrizes ?? []).map((row: any) => [row.id, row.disciplina_id]));
  const disciplinaMap = new Map((disciplinas ?? []).map((row: any) => [row.id, row.nome]));
  return NextResponse.json({ ok: true, items: rows.map((row) => { const td = tdMap.get(row.turma_disciplina_id); const disciplinaId = td ? matrizMap.get(td.curso_matriz_id) : null; return { ...row, turma_id: td?.turma_id ?? null, disciplina_id: disciplinaId ?? null, turma_nome: td ? turmaMap.get(td.turma_id) ?? null : null, disciplina_nome: disciplinaId ? disciplinaMap.get(disciplinaId) ?? null : null }; }) });
}
