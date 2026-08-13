import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROLES = ["secretaria", "secretaria_financeiro", "admin_financeiro", "admin_secretaria", "admin", "admin_escola", "staff_admin", "diretor"] as const;

export async function GET(req: Request) {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return NextResponse.json({ ok: true, items: [], summary: {} });
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: [...ROLES] });
  if (authz.error) return authz.error;

  const params = new URL(req.url).searchParams;
  const data = params.get("data") ?? new Date().toISOString().slice(0, 10);
  const status = params.get("status");
  let query = supabase
    .from("aulas")
    .select("id, turma_disciplina_id, data, slot_id, professor_id, inicio_previsto, fim_previsto, inicio_real, fim_real, status, resumo, observacoes, conteudo, created_at")
    .eq("escola_id", escolaId)
    .eq("data", data)
    .order("inicio_previsto", { ascending: true, nullsFirst: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  const { data: aulas, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (aulas ?? []) as Array<Record<string, any>>;
  const tdIds = Array.from(new Set(rows.map((row) => row.turma_disciplina_id).filter(Boolean)));
  const professorIds = Array.from(new Set(rows.map((row) => row.professor_id).filter(Boolean)));
  const [tdRes, profRes] = await Promise.all([
    tdIds.length
      ? supabase.from("turma_disciplinas").select("id, turma_id, curso_matriz_id").eq("escola_id", escolaId).in("id", tdIds)
      : Promise.resolve({ data: [] }),
    professorIds.length
      ? supabase.from("professores").select("id, nome, profile_id").eq("escola_id", escolaId).in("id", professorIds)
      : Promise.resolve({ data: [] }),
  ]);
  const tdRows = (tdRes.data ?? []) as Array<{ id: string; turma_id: string; curso_matriz_id: string }>;
  const turmaIds = Array.from(new Set(tdRows.map((row) => row.turma_id).filter(Boolean)));
  const matrizIds = Array.from(new Set(tdRows.map((row) => row.curso_matriz_id).filter(Boolean)));
  const [turmasRes, matrizesRes] = await Promise.all([
    turmaIds.length ? supabase.from("turmas").select("id, nome").eq("escola_id", escolaId).in("id", turmaIds) : Promise.resolve({ data: [] }),
    matrizIds.length ? supabase.from("curso_matriz").select("id, disciplina_id").eq("escola_id", escolaId).in("id", matrizIds) : Promise.resolve({ data: [] }),
  ]);
  const disciplinaIds = Array.from(new Set(((matrizesRes.data ?? []) as Array<{ disciplina_id: string }>).map((row) => row.disciplina_id).filter(Boolean)));
  const { data: disciplinas } = disciplinaIds.length
    ? await supabase.from("disciplinas_catalogo").select("id, nome").eq("escola_id", escolaId).in("id", disciplinaIds)
    : { data: [] };
  const tdMap = new Map(tdRows.map((row) => [row.id, row]));
  const turmaMap = new Map(((turmasRes.data ?? []) as Array<{ id: string; nome: string | null }>).map((row) => [row.id, row.nome]));
  const matrizMap = new Map(((matrizesRes.data ?? []) as Array<{ id: string; disciplina_id: string }>).map((row) => [row.id, row.disciplina_id]));
  const disciplinaMap = new Map(((disciplinas ?? []) as Array<{ id: string; nome: string | null }>).map((row) => [row.id, row.nome]));
  const professorMap = new Map(((profRes.data ?? []) as Array<{ id: string; nome: string | null }>).map((row) => [row.id, row.nome]));
  const items: Array<Record<string, any>> = rows.map((row) => {
    const td = tdMap.get(row.turma_disciplina_id);
    const disciplinaId = td ? matrizMap.get(td.curso_matriz_id) : null;
    return { ...row, turma_id: td?.turma_id ?? null, turma_nome: td ? turmaMap.get(td.turma_id) ?? null : null, disciplina_id: disciplinaId, disciplina_nome: disciplinaId ? disciplinaMap.get(disciplinaId) ?? null : null, professor_nome: row.professor_id ? professorMap.get(row.professor_id) ?? null : null };
  });
  const aulaIds = items.map((item) => item.id).filter(Boolean);
  const { data: frequencias } = aulaIds.length
    ? await supabase.from("frequencias").select("aula_id, status").eq("escola_id", escolaId).in("aula_id", aulaIds).limit(1000)
    : { data: [] };
  const { data: planos } = aulaIds.length
    ? await supabase.from("planos_aula").select("aula_id, status, tema").eq("escola_id", escolaId).in("aula_id", aulaIds).order("updated_at", { ascending: false }).limit(200)
    : { data: [] };
  const attendanceMap = new Map<string, { presentes: number; faltas: number; atrasos: number; total: number }>();
  for (const row of frequencias ?? []) {
    if (!row.aula_id) continue;
    const current = attendanceMap.get(row.aula_id) ?? { presentes: 0, faltas: 0, atrasos: 0, total: 0 };
    current.total += 1;
    if (row.status === "presente") current.presentes += 1;
    if (row.status === "falta") current.faltas += 1;
    if (row.status === "atraso") current.atrasos += 1;
    attendanceMap.set(row.aula_id, current);
  }
  const planMap = new Map<string, { status: string; tema: string | null }>();
  for (const row of planos ?? []) if (row.aula_id && !planMap.has(row.aula_id)) planMap.set(row.aula_id, { status: row.status, tema: row.tema });
  for (const item of items) {
    item.presencas = attendanceMap.get(item.id) ?? { presentes: 0, faltas: 0, atrasos: 0, total: 0 };
    item.plano_aula = planMap.get(item.id) ?? null;
  }
  const summary = items.reduce((acc, item) => { acc[item.status] = (acc[item.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  return NextResponse.json({ ok: true, data, items, summary });
}
