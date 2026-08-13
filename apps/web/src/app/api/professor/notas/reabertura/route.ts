import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const Body = z.object({ turma_id: z.string().uuid(), disciplina_id: z.string().uuid(), trimestre: z.number().int().min(1).max(3), ano_letivo_id: z.string().uuid(), motivo: z.string().trim().min(5).max(1000) });

async function context() {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  const escolaId = auth.user ? await resolveEscolaIdForUser(supabase, auth.user.id) : null;
  return { supabase, user: auth.user, escolaId };
}

export async function GET(req: Request) {
  const { supabase, user, escolaId } = await context();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
  const params = new URL(req.url).searchParams;
  let query = supabase.from("excecoes_pauta").select("id, turma_id, disciplina_id, trimestre, status, motivo, decisao_motivo, expira_em, created_at, decidido_em").eq("escola_id", escolaId).eq("solicitado_por", user.id).order("created_at", { ascending: false }).limit(20);
  if (params.get("turma_id")) query = query.eq("turma_id", params.get("turma_id"));
  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const turmaId = params.get("turma_id");
  const disciplinaId = params.get("disciplina_id");
  const trimestre = params.get("trimestre");
  const current = (data ?? []).find((item: any) => (!turmaId || item.turma_id === turmaId) && (!disciplinaId || item.disciplina_id === disciplinaId) && (!trimestre || String(item.trimestre) === trimestre));
  return NextResponse.json({ ok: true, items: data ?? [], current: current ?? null, can_edit: current?.status === "APROVADO" && new Date(current.expira_em).getTime() > Date.now() });
}

export async function POST(req: Request) {
  const { supabase, user, escolaId } = await context();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  const { data: professor } = await supabase.from("professores").select("id").eq("escola_id", escolaId).eq("profile_id", user.id).maybeSingle();
  if (!professor?.id) return NextResponse.json({ ok: false, error: "Professor não encontrado" }, { status: 403 });
  const { data: assignment } = await supabase.from("turma_disciplinas_professores").select("id").eq("escola_id", escolaId).eq("professor_id", professor.id).eq("turma_id", parsed.data.turma_id).eq("disciplina_id", parsed.data.disciplina_id).maybeSingle();
  if (!assignment?.id) return NextResponse.json({ ok: false, error: "Você não está atribuído a esta turma e disciplina." }, { status: 403 });
  const { data: anoLetivo } = await supabase.from("anos_letivos").select("id").eq("id", parsed.data.ano_letivo_id).eq("escola_id", escolaId).maybeSingle();
  if (!anoLetivo?.id) return NextResponse.json({ ok: false, error: "Ano letivo inválido para esta escola." }, { status: 400 });
  const { data: existing } = await supabase.from("excecoes_pauta").select("id, status").eq("escola_id", escolaId).eq("turma_id", parsed.data.turma_id).eq("disciplina_id", parsed.data.disciplina_id).eq("trimestre", parsed.data.trimestre).eq("solicitado_por", user.id).in("status", ["PENDENTE", "APROVADO"]).gt("expira_em", new Date().toISOString()).maybeSingle();
  if (existing) return NextResponse.json({ ok: false, error: "Já existe uma solicitação ativa para este trimestre." }, { status: 409 });
  const { data, error } = await supabase.from("excecoes_pauta").insert({ escola_id: escolaId, turma_id: parsed.data.turma_id, disciplina_id: parsed.data.disciplina_id, trimestre: parsed.data.trimestre, user_id: user.id, motivo: parsed.data.motivo, expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), criado_por: user.id, solicitado_por: user.id, ano_letivo_id: parsed.data.ano_letivo_id, status: "PENDENTE" }).select("id, status, motivo, created_at").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data }, { status: 201 });
}
