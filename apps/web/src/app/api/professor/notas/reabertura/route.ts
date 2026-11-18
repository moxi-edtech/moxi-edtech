import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { resolveReopeningSubject } from "@/lib/academico/resolve-reopening-subject";
import { reopeningDisplayState, type ReopeningStoredState } from "@/lib/academico/reopening-display";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const Body = z.object({
  turma_id: z.string().uuid(),
  disciplina_id: z.string().uuid(),
  trimestre: z.number().int().min(1).max(3),
  ano_letivo_id: z.string().uuid(),
  motivo: z.string().trim().min(5).max(1000),
});


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
  let query = supabase.from("excecoes_pauta")
    .select("id, turma_id, disciplina_id, disciplina_catalogo_id, trimestre, status, motivo, decisao_motivo, expira_em, created_at, decidido_em, ano_letivo_id")
    .eq("escola_id", escolaId).eq("solicitado_por", user.id)
    .order("created_at", { ascending: false }).limit(20);
  if (params.get("turma_id")) query = query.eq("turma_id", params.get("turma_id"));
  if (params.get("ano_letivo_id")) query = query.eq("ano_letivo_id", params.get("ano_letivo_id"));
  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: "Não foi possível consultar as solicitações." }, { status: 500 });

  const turmaId = params.get("turma_id");
  const disciplinaId = params.get("disciplina_id");
  const trimestre = params.get("trimestre");
  const current = (data ?? []).find((item: {
    turma_id: string;
    disciplina_id: string | null;
    disciplina_catalogo_id: string | null;
    trimestre: number | null;
  }) => (!turmaId || item.turma_id === turmaId) &&
    (!disciplinaId || (item.disciplina_catalogo_id ?? item.disciplina_id) === disciplinaId) &&
    (!trimestre || String(item.trimestre) === trimestre));

  const now = Date.now();
  const effectiveStatus = (item: { status: string; expira_em: string | null }) => {
    const status = item.status;
    if (status !== "PENDENTE" && status !== "APROVADO" &&
        status !== "REJEITADO" && status !== "EXPIRADO") return "EXPIRADO";
    return reopeningDisplayState(status as ReopeningStoredState, item.expira_em, now);
  };
  const items = (data ?? []).map((item: { status: string; expira_em: string | null }) =>
    ({ ...item, status: effectiveStatus(item) }));
  const selected = current ? { ...current, status: effectiveStatus(current) } : null;
  return NextResponse.json({
    ok: true,
    items,
    current: selected,
    can_edit: selected?.status === "APROVADO" && Date.parse(selected.expira_em ?? "") > now,
  });
}

export async function POST(req: Request) {
  const { supabase, user, escolaId } = await context();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });

  // A turma, o ano e a disciplina curricular são resolvidos numa única consulta.
  // Nunca confiar no ID de disciplina de avaliação enviado pelo cliente.
  const { data: turma, error: turmaError } = await supabase.from("turmas")
    .select("id, turma_disciplinas(id, professor_id, avaliacao_disciplina_id, curso_matriz:curso_matriz_id(disciplina_id, avaliacao_disciplina_id))")
    .eq("id", parsed.data.turma_id)
    .eq("escola_id", escolaId)
    .eq("ano_letivo_id", parsed.data.ano_letivo_id)
    .maybeSingle();
  if (turmaError || !turma) return NextResponse.json({
    ok: false, error: "A turma não pertence ao ano letivo seleccionado nesta escola.",
  }, { status: 400 });
  const links = (turma.turma_disciplinas ?? []).map((record) => ({
    id: record.id,
    professor_id: record.professor_id,
    avaliacao_disciplina_id: record.avaliacao_disciplina_id,
    curso_matriz: Array.isArray(record.curso_matriz)
      ? (record.curso_matriz.length === 1 ? record.curso_matriz[0] : null)
      : record.curso_matriz,
  }));
  const resolution = resolveReopeningSubject(links, parsed.data.disciplina_id);
  if (!resolution.ok) {
    const messages = {
      UNKNOWN: "A disciplina curricular é ambígua ou não pertence à turma.",
      UNRECONCILED: "A disciplina avaliada ainda não está reconciliada. Solicita revisão à Direção.",
      SHARED_ASSESSMENT: "A disciplina avaliada é partilhada por várias disciplinas. Solicita revisão à Direção.",
    };
    return NextResponse.json({ ok: false, error: messages[resolution.code] }, { status: 409 });
  }
  const { link: td, assessedSubjectId: disciplinaAvaliadaId } = resolution;

  const { data: professor } = await supabase.from("professores")
    .select("id").eq("escola_id", escolaId).eq("profile_id", user.id).maybeSingle();
  if (!professor?.id) return NextResponse.json({ ok: false, error: "Professor não encontrado" }, { status: 403 });
  if (td.professor_id !== professor.id) {
    const { data: assignment } = await supabase.from("turma_disciplinas_professores")
      .select("id").eq("escola_id", escolaId).eq("professor_id", professor.id)
      .eq("turma_id", parsed.data.turma_id)
      .eq("disciplina_id", parsed.data.disciplina_id).maybeSingle();
    if (!assignment?.id) return NextResponse.json({
      ok: false, error: "Não tens atribuição nesta turma e disciplina.",
    }, { status: 403 });
  }

  // A autorização existente verifica o ID avaliado, o mesmo que fica no pedido.
  const { data: existing, error: existingError } = await supabase.from("excecoes_pauta")
    .select("id, status").eq("escola_id", escolaId)
    .eq("turma_id", parsed.data.turma_id)
    .eq("ano_letivo_id", parsed.data.ano_letivo_id)
    .eq("disciplina_id", disciplinaAvaliadaId)
    .eq("trimestre", parsed.data.trimestre)
    .eq("solicitado_por", user.id)
    .in("status", ["PENDENTE", "APROVADO"])
    .gt("expira_em", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existingError) return NextResponse.json({ ok: false, error: "Não foi possível verificar pedidos anteriores." }, { status: 500 });
  if (existing) return NextResponse.json({ ok: false, error: "Já existe uma solicitação ativa para este trimestre." }, { status: 409 });

  const { data, error } = await supabase.from("excecoes_pauta").insert({
    escola_id: escolaId,
    turma_id: parsed.data.turma_id,
    disciplina_id: disciplinaAvaliadaId,
    disciplina_catalogo_id: parsed.data.disciplina_id,
    trimestre: parsed.data.trimestre,
    user_id: user.id,
    motivo: parsed.data.motivo,
    expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    criado_por: user.id,
    solicitado_por: user.id,
    ano_letivo_id: parsed.data.ano_letivo_id,
    status: "PENDENTE",
  }).select("id, status, motivo, created_at").single();
  if (error) return NextResponse.json({ ok: false, error: "Não foi possível registar a solicitação." }, { status: 400 });
  return NextResponse.json({ ok: true, item: data }, { status: 201 });
}
