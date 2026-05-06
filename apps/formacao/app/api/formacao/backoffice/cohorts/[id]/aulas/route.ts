import { NextResponse } from "next/server";
import { requireFormacaoRoles, assertCohortAccess } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_admin",
  "formacao_secretaria",
  "formador",
  "super_admin",
  "global_admin",
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const p = await params;
  const cohortId = String(p.id ?? "").trim();
  if (!cohortId) {
    return NextResponse.json({ ok: false, error: "id da turma é obrigatório" }, { status: 400 });
  }

  const s = auth.supabase as FormacaoSupabaseClient;

  // Verify cohort access
  const access = await assertCohortAccess(s, auth.userId, auth.escolaId, auth.role, cohortId);
  if (!access.ok) return access.response;

  const { data, error } = await s
    .from("formacao_aulas")
    .select("*")
    .eq("escola_id", auth.escolaId)
    .eq("cohort_id", cohortId)
    .order("data", { ascending: false })
    .order("hora_inicio", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, items: data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const p = await params;
  const cohortId = String(p.id ?? "").trim();
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    data?: string;
    hora_inicio?: string;
    hora_fim?: string;
    conteudo_previsto?: string;
    conteudo_realizado?: string;
    horas_ministradas?: number;
    status?: string;
    formador_user_id?: string;
  } | null;

  if (!body?.data) {
    return NextResponse.json({ ok: false, error: "Data é obrigatória" }, { status: 400 });
  }

  const s = auth.supabase as FormacaoSupabaseClient;

  // Verify cohort access
  const access = await assertCohortAccess(s, auth.userId, auth.escolaId, auth.role, cohortId);
  if (!access.ok) return access.response;

  const payload = {
    escola_id: auth.escolaId,
    cohort_id: cohortId,
    formador_user_id: body.formador_user_id || auth.userId,
    data: body.data,
    hora_inicio: body.hora_inicio || null,
    hora_fim: body.hora_fim || null,
    conteudo_previsto: body.conteudo_previsto || null,
    conteudo_realizado: body.conteudo_realizado || null,
    horas_ministradas: Number(body.horas_ministradas ?? 0),
    status: body.status || "agendada",
    updated_at: new Date().toISOString(),
  };

  let result;
  if (body.id) {
    result = await s
      .from("formacao_aulas")
      .update(payload)
      .eq("id", body.id)
      .eq("escola_id", auth.escolaId)
      .select()
      .single();
  } else {
    result = await s
      .from("formacao_aulas")
      .insert(payload)
      .select()
      .single();
  }

  const { data, error } = result;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  // If the class is marked as 'realizada', ensure presences are initialized
  if (body.status === "realizada") {
    // Check if presences already exist to avoid duplicates
    const { count } = await s
      .from("formacao_presencas")
      .select("id", { count: "exact", head: true })
      .eq("aula_id", data.id);

    if (count === 0) {
      const { data: inscricoes } = await s
        .from("formacao_inscricoes")
        .select("id")
        .eq("escola_id", auth.escolaId)
        .eq("cohort_id", cohortId)
        .in("estado", ["inscrito", "concluido", "cursando"]);

      if (inscricoes && inscricoes.length > 0) {
        await s.from("formacao_presencas").insert(
          inscricoes.map((i) => ({
            escola_id: auth.escolaId,
            aula_id: data.id,
            inscricao_id: i.id,
            presente: true,
          }))
        );
      }
    }
  }

  return NextResponse.json({ ok: true, item: data });
}
