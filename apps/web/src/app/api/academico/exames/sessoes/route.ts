import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveRegimeAcademico } from "@/lib/academico/regime-academico";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const sessionSchema = z.object({
  ano_letivo_id: z.string().uuid(),
  turma_id: z.string().uuid().nullable().optional(),
  tipo: z.enum(["exame_nacional", "recurso", "extraordinario"]),
  modalidade: z.enum(["simples", "escrita_oral", "oral_pratica"]).default("simples"),
  data_inicio: z.string().date(),
  data_fim: z.string().date(),
  observacoes: z.string().trim().max(5000).nullable().optional(),
  componentes: z.array(z.object({
    codigo: z.enum(["escrita", "oral", "pratica"]),
    peso: z.number().positive().max(100).default(1),
    nota_max: z.number().positive().max(100).default(20),
  })).max(3).optional(),
});

const sessionRoles = ["admin", "admin_escola", "staff_admin", "diretor", "secretaria", "professor"] as const;

export async function GET(request: Request) {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: [...sessionRoles] });
  if (authz.error) return authz.error;

  const params = new URL(request.url).searchParams;
  let query = supabase.from("exame_sessoes").select("*, exame_componentes(*)").eq("escola_id", escolaId).order("data_inicio", { ascending: true }).order("id", { ascending: true }).limit(50);
  if (params.get("ano_letivo_id")) query = query.eq("ano_letivo_id", params.get("ano_letivo_id"));
  if (params.get("turma_id")) query = query.eq("turma_id", params.get("turma_id"));
  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: [...sessionRoles] });
  if (authz.error) return authz.error;
  const parsed = sessionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  const body = parsed.data;
  if (body.data_fim < body.data_inicio) return NextResponse.json({ ok: false, error: "A data final deve ser posterior à data inicial." }, { status: 400 });

  const { data: anoLetivo, error: anoError } = await supabase
    .from("anos_letivos")
    .select("id, data_inicio, data_fim")
    .eq("id", body.ano_letivo_id)
    .eq("escola_id", escolaId)
    .maybeSingle();
  if (anoError) return NextResponse.json({ ok: false, error: anoError.message }, { status: 500 });
  if (!anoLetivo) return NextResponse.json({ ok: false, error: "Ano letivo não pertence à escola." }, { status: 409 });
  if (body.data_inicio < anoLetivo.data_inicio || body.data_fim > anoLetivo.data_fim) {
    return NextResponse.json({ ok: false, error: "A sessão de exame deve ficar dentro do período do ano letivo.", code: "EXAM_SESSION_OUTSIDE_ACADEMIC_YEAR" }, { status: 409 });
  }

  const componentes = body.componentes ?? [{ codigo: "escrita" as const, peso: 1, nota_max: 20 }];
  const expectedCodes = body.modalidade === "escrita_oral"
    ? ["escrita", "oral"]
    : body.modalidade === "oral_pratica"
      ? ["oral", "pratica"]
      : ["escrita"];
  const componentCodes = componentes.map((component) => component.codigo);
  if (componentCodes.length !== new Set(componentCodes).size || componentCodes.slice().sort().join(",") !== expectedCodes.slice().sort().join(",")) {
    return NextResponse.json({ ok: false, error: `A modalidade ${body.modalidade} exige os componentes: ${expectedCodes.join(" e ")}.`, code: "EXAM_COMPONENTS_INVALID" }, { status: 400 });
  }

  if (body.turma_id) {
    const { data: turma } = await supabase.from("turmas").select("id, escola_id, ano_letivo").eq("id", body.turma_id).eq("escola_id", escolaId).maybeSingle();
    if (!turma || String(turma.ano_letivo) !== String((await supabase.from("anos_letivos").select("ano").eq("id", body.ano_letivo_id).maybeSingle()).data?.ano)) {
      return NextResponse.json({ ok: false, error: "A turma não pertence ao ano letivo selecionado.", code: "EXAM_TURMA_ACADEMIC_YEAR_MISMATCH" }, { status: 409 });
    }
    const regime = await resolveRegimeAcademico(supabase, body.turma_id);
    if (!regime.eh_classe_exame) return NextResponse.json({ ok: false, error: "A turma não está abrangida por um regime de exame.", code: "TURMA_NOT_EXAM_REGIME" }, { status: 409 });
  }

  const { componentes: _componentes, ...sessionData } = body;
  const { data: session, error } = await supabase.from("exame_sessoes").insert({ ...sessionData, escola_id: escolaId, created_by: auth.user.id }).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
  const { error: componentError } = await (supabase as any).from("exame_componentes").insert(componentes.map((component) => ({ ...component, escola_id: escolaId, exame_sessao_id: session.id })));
  if (componentError) return NextResponse.json({ ok: false, error: componentError.message, code: "EXAM_COMPONENTS_CREATE_FAILED", session_id: session.id }, { status: 500 });
  const { data, error: reloadError } = await supabase.from("exame_sessoes").select("*, exame_componentes(*)").eq("id", session.id).eq("escola_id", escolaId).single();
  if (reloadError) return NextResponse.json({ ok: false, error: reloadError.message, session_id: session.id }, { status: 500 });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
