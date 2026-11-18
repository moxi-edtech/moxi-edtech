import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { findSuspectedSubjectEquivalences } from "@/lib/academico/discipline-equivalences";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const Uuid = z.string().uuid();
const Context = z.object({ curso_id: Uuid, ano_letivo_id: Uuid });
const Decision = Context.extend({
  classe_id: Uuid,
  nome_normalizado: z.string().trim().min(2).max(180),
  disciplina_oficial_id: Uuid,
  motivo: z.string().trim().min(5).max(1000),
});

async function schoolContext() {
  const supabase = await supabaseServerTyped<any>();
  const { data: { user } } = await supabase.auth.getUser();
  const escolaId = user ? await resolveEscolaIdForUser(supabase, user.id) : null;
  return { supabase, user, escolaId };
}

export async function GET(request: Request) {
  const { supabase, user, escolaId } = await schoolContext();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada." }, { status: 403 });
  const parsed = Context.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Contexto inválido." }, { status: 400 });
  const { data, error } = await supabase.from("disciplina_equivalencia_decisoes")
    .select("id, classe_id, nome_normalizado, disciplina_oficial_id, candidatos_ids, motivo, decidido_em")
    .eq("escola_id", escolaId).eq("curso_id", parsed.data.curso_id)
    .eq("ano_letivo_id", parsed.data.ano_letivo_id).limit(200);
  if (error) return NextResponse.json({ ok: false, error: "Não foi possível consultar as decisões." }, { status: 503 });
  const { data: membership } = await supabase.from("escola_users")
    .select("papel").eq("escola_id", escolaId).eq("user_id", user.id).maybeSingle();
  const canDecide = ["diretor", "admin_escola", "admin"].includes(membership?.papel ?? "");
  return NextResponse.json({ ok: true, items: data ?? [], can_decide: canDecide });
}

export async function POST(request: Request) {
  const { supabase, user, escolaId } = await schoolContext();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada." }, { status: 403 });
  const parsed = Decision.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Decisão inválida." }, { status: 400 });
  const { curso_id, classe_id, ano_letivo_id, nome_normalizado, disciplina_oficial_id, motivo } = parsed.data;

  // Verificação estrita: não usar o helper de papéis com aliases que incluem
  // admin_financeiro. A decisão curricular pertence apenas à Direção.
  const { data: membership, error: membershipError } = await supabase.from("escola_users")
    .select("papel").eq("escola_id", escolaId).eq("user_id", user.id).maybeSingle();
  if (membershipError || !["diretor", "admin_escola", "admin"].includes(membership?.papel ?? "")) {
    return NextResponse.json({ ok: false, error: "A decisão exige autorização da Direção." }, { status: 403 });
  }

  // Não confiar nos candidatos enviados pelo browser: recuperar o currículo
  // do mesmo ano, curso e classe antes de permitir qualquer escolha.
  const { data: curriculos, error: curriculoError } = await supabase.from("curso_curriculos")
    .select("id, classe_id").eq("escola_id", escolaId)
    .eq("curso_id", curso_id).eq("ano_letivo_id", ano_letivo_id).limit(201);
  if (curriculoError || !curriculos || curriculos.length > 200) {
    return NextResponse.json({ ok: false, error: "Não foi possível validar o currículo." }, { status: 409 });
  }
  const curriculumIds = curriculos.filter((c: { classe_id: string | null }) =>
    !c.classe_id || c.classe_id === classe_id).map((c: { id: string }) => c.id);
  if (curriculumIds.length === 0) {
    return NextResponse.json({ ok: false, error: "Classe sem currículo neste ano letivo." }, { status: 409 });
  }
  const { data: matrices, error: matrixError } = await supabase.from("curso_matriz")
    .select("disciplina_id").eq("escola_id", escolaId)
    .eq("curso_id", curso_id).eq("classe_id", classe_id)
    .in("curso_curriculo_id", curriculumIds).limit(501);
  if (matrixError || !matrices || matrices.length > 500) {
    return NextResponse.json({ ok: false, error: "Matriz curricular não verificável." }, { status: 409 });
  }
  const ids = [...new Set(matrices.map((m: { disciplina_id: string }) => m.disciplina_id))];
  if (ids.length < 2 || ids.length > 200) {
    return NextResponse.json({ ok: false, error: "Não existem candidatos válidos." }, { status: 409 });
  }
  const { data: subjects, error: subjectsError } = await supabase.from("disciplinas_catalogo")
    .select("id, nome").eq("escola_id", escolaId).in("id", ids).limit(201);
  if (subjectsError || !subjects || subjects.length !== ids.length) {
    return NextResponse.json({ ok: false, error: "Disciplinas não verificáveis." }, { status: 409 });
  }
  const groups = findSuspectedSubjectEquivalences(subjects.map((s: { id: string; nome: string }) =>
    ({ ...s, class_ids: [classe_id] })));
  const group = groups.find((g) => g.classId === classe_id && g.normalizedName === nome_normalizado);
  if (!group || group.candidates.length > 30 ||
      !group.candidates.some((candidate) => candidate.id === disciplina_oficial_id)) {
    return NextResponse.json({ ok: false, error: "A escolha não corresponde às disciplinas equivalentes deste currículo." }, { status: 409 });
  }

  const { data, error } = await supabase.from("disciplina_equivalencia_decisoes")
    .insert({
      escola_id: escolaId, curso_id, classe_id, ano_letivo_id, nome_normalizado,
      disciplina_oficial_id, candidatos_ids: group.candidates.map((c) => c.id).sort(),
      motivo, decidido_por: user.id,
    })
    .select("id, classe_id, nome_normalizado, disciplina_oficial_id, candidatos_ids, motivo, decidido_em")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.code === "23505"
      ? "Esta equivalência já foi decidida. Actualiza a página."
      : "Não foi possível registar a decisão." }, { status: error.code === "23505" ? 409 : 403 });
  }
  return NextResponse.json({ ok: true, item: data }, { status: 201 });
}
