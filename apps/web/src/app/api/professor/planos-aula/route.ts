import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PlanSchema = z.object({
  id: z.string().uuid().optional(),
  turma_id: z.string().uuid(),
  disciplina_id: z.string().uuid(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  aula_id: z.string().uuid().nullable().optional(),
  status: z.enum(["rascunho", "enviado"]).default("rascunho"),
  tema: z.string().trim().min(2).max(300),
  subtema: z.string().trim().max(500).nullable().optional(),
  objetivos: z.string().trim().max(5000).nullable().optional(),
  competencias: z.string().trim().max(5000).nullable().optional(),
  conteudos: z.string().trim().max(5000).nullable().optional(),
  metodologia: z.string().trim().max(5000).nullable().optional(),
  recursos: z.string().trim().max(5000).nullable().optional(),
  atividades: z.string().trim().max(5000).nullable().optional(),
  avaliacao: z.string().trim().max(5000).nullable().optional(),
  tarefa_casa: z.string().trim().max(5000).nullable().optional(),
  anotacoes_alunos_avaliados: z.string().trim().max(10000).nullable().optional(),
  observacoes: z.string().trim().max(5000).nullable().optional(),
  arquivo_url: z.string().url().max(2000).nullable().optional(),
});

async function getContext(supabase: any, userId: string, turmaId: string, disciplinaId: string) {
  const escolaId = await resolveEscolaIdForUser(supabase, userId);
  if (!escolaId) return { error: NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 }) };
  const [{ data: professor }, { data: turma }] = await Promise.all([
    supabase.from("professores").select("id").eq("escola_id", escolaId).eq("profile_id", userId).maybeSingle(),
    supabase.from("turmas").select("id, curso_id, classe_id").eq("escola_id", escolaId).eq("id", turmaId).maybeSingle(),
  ]);
  if (!professor?.id || !turma?.curso_id || !turma?.classe_id) return { error: NextResponse.json({ ok: false, error: "Professor ou turma inválida" }, { status: 403 }) };
  const { data: matriz } = await supabase.from("curso_matriz").select("id").eq("escola_id", escolaId).eq("curso_id", turma.curso_id).eq("classe_id", turma.classe_id).eq("disciplina_id", disciplinaId).eq("ativo", true).maybeSingle();
  if (!matriz?.id) return { error: NextResponse.json({ ok: false, error: "Disciplina não pertence à turma" }, { status: 404 }) };
  const { data: assignment } = await supabase.from("turma_disciplinas").select("id, professor_id").eq("escola_id", escolaId).eq("turma_id", turmaId).eq("curso_matriz_id", matriz.id).maybeSingle();
  const { data: shared } = await supabase.from("turma_disciplinas_professores").select("id").eq("escola_id", escolaId).eq("turma_id", turmaId).eq("disciplina_id", disciplinaId).eq("professor_id", professor.id).limit(1);
  if (!assignment?.id || (assignment.professor_id !== professor.id && !(shared ?? []).length)) return { error: NextResponse.json({ ok: false, error: "Professor não atribuído a esta disciplina" }, { status: 403 }) };
  return { escolaId, professorId: professor.id, turmaDisciplinaId: assignment.id };
}

export async function GET(req: Request) {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return NextResponse.json({ ok: true, items: [] });
  const { data: professor } = await supabase.from("professores").select("id").eq("escola_id", escolaId).eq("profile_id", auth.user.id).maybeSingle();
  if (!professor?.id) return NextResponse.json({ ok: false, error: "Professor não encontrado" }, { status: 403 });
  const date = new URL(req.url).searchParams.get("data");
  let query = supabase.from("planos_aula").select("*").eq("escola_id", escolaId).eq("professor_id", professor.id).order("data", { ascending: false }).limit(100);
  if (date) query = query.eq("data", date);
  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const rows = (data ?? []) as Array<any>;
  const tdIds = Array.from(new Set(rows.map((row) => row.turma_disciplina_id).filter(Boolean)));
  const { data: tdRows } = tdIds.length ? await supabase.from("turma_disciplinas").select("id, turma_id, curso_matriz_id").eq("escola_id", escolaId).in("id", tdIds) : { data: [] };
  const matrizIds = Array.from(new Set((tdRows ?? []).map((row: any) => row.curso_matriz_id).filter(Boolean)));
  const { data: matrizRows } = matrizIds.length ? await supabase.from("curso_matriz").select("id, disciplina_id").eq("escola_id", escolaId).in("id", matrizIds) : { data: [] };
  const tdMap = new Map((tdRows ?? []).map((row: any) => [row.id, row]));
  const matrizMap = new Map((matrizRows ?? []).map((row: any) => [row.id, row.disciplina_id]));
  return NextResponse.json({ ok: true, items: rows.map((row) => {
    const td = tdMap.get(row.turma_disciplina_id);
    return { ...row, turma_id: td?.turma_id ?? null, disciplina_id: td ? matrizMap.get(td.curso_matriz_id) ?? null : null };
  }) });
}

export async function POST(req: Request) {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const parsed = PlanSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Preencha o tema e os campos válidos do plano." }, { status: 400 });
  const context = await getContext(supabase, auth.user.id, parsed.data.turma_id, parsed.data.disciplina_id);
  if (context.error) return context.error;
  const { escolaId, professorId, turmaDisciplinaId } = context;
  const payload = { escola_id: escolaId, aula_id: parsed.data.aula_id ?? null, turma_disciplina_id: turmaDisciplinaId, professor_id: professorId, data: parsed.data.data, status: parsed.data.status, ...Object.fromEntries(Object.entries(parsed.data).filter(([key]) => !["id", "turma_id", "disciplina_id", "aula_id", "data", "status"].includes(key))), created_by: auth.user.id, updated_at: new Date().toISOString(), submitted_at: parsed.data.status === "enviado" ? new Date().toISOString() : null };
  const query = parsed.data.id
    ? supabase.from("planos_aula").update(payload).eq("id", parsed.data.id).eq("escola_id", escolaId).eq("professor_id", professorId).select("*").single()
    : supabase.from("planos_aula").upsert(payload, { onConflict: "escola_id,turma_disciplina_id,professor_id,data" }).select("*").single();
  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data });
}
