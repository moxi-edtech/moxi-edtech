import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_admin",
  "formacao_secretaria",
  "super_admin",
  "global_admin",
];

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;
  const { data, error } = await s
    .from("formacao_cohorts")
    .select(
      "id, codigo, nome, curso_nome, carga_horaria_total, vagas, data_inicio, data_fim, status, created_at"
    )
    .eq("escola_id", auth.escolaId)
    .order("data_inicio", { ascending: false })
    .limit(300);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    codigo?: string;
    nome?: string;
    curso_nome?: string;
    carga_horaria_total?: number;
    vagas?: number;
    data_inicio?: string;
    data_fim?: string;
    status?: "planeada" | "em_andamento" | "concluida" | "cancelada";
  } | null;

  const codigo = String(body?.codigo ?? "").trim().toUpperCase();
  const nome = String(body?.nome ?? "").trim();
  const cursoNome = String(body?.curso_nome ?? "").trim();
  const cargaHoraria = Number(body?.carga_horaria_total ?? 0);
  const vagas = Number(body?.vagas ?? 0);
  const dataInicio = String(body?.data_inicio ?? "").trim();
  const dataFim = String(body?.data_fim ?? "").trim();
  const status = body?.status ?? "planeada";

  if (!codigo || !nome || !cursoNome || !dataInicio || !dataFim || cargaHoraria <= 0 || vagas <= 0) {
    return NextResponse.json(
      { ok: false, error: "Preencha codigo, nome, curso, datas, carga horária e vagas" },
      { status: 400 }
    );
  }

  const s = auth.supabase as FormacaoSupabaseClient;
  const { data, error } = await s
    .from("formacao_cohorts")
    .insert({
      escola_id: auth.escolaId,
      codigo,
      nome,
      curso_nome: cursoNome,
      carga_horaria_total: cargaHoraria,
      vagas,
      data_inicio: dataInicio,
      data_fim: dataFim,
      status,
    })
    .select(
      "id, codigo, nome, curso_nome, carga_horaria_total, vagas, data_inicio, data_fim, status"
    )
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data });
}

export async function PATCH(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    nome?: string;
    curso_nome?: string;
    vagas?: number;
    data_inicio?: string;
    data_fim?: string;
    status?: "planeada" | "em_andamento" | "concluida" | "cancelada";
  } | null;

  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.nome === "string") patch.nome = body.nome.trim();
  if (typeof body?.curso_nome === "string") patch.curso_nome = body.curso_nome.trim();
  if (body?.vagas !== undefined) {
    const vagas = Number(body.vagas);
    if (vagas <= 0) return NextResponse.json({ ok: false, error: "vagas deve ser maior que zero" }, { status: 400 });
    patch.vagas = vagas;
  }
  if (typeof body?.data_inicio === "string") patch.data_inicio = body.data_inicio.trim();
  if (typeof body?.data_fim === "string") patch.data_fim = body.data_fim.trim();
  if (body?.status && ["planeada", "em_andamento", "concluida", "cancelada"].includes(body.status)) {
    patch.status = body.status;
  }

  const s = auth.supabase as FormacaoSupabaseClient;
  const { data, error } = await s
    .from("formacao_cohorts")
    .update(patch)
    .eq("escola_id", auth.escolaId)
    .eq("id", id)
    .select("id, codigo, nome, curso_nome, carga_horaria_total, vagas, data_inicio, data_fim, status")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  const s = auth.supabase as FormacaoSupabaseClient;
  const { error } = await s
    .from("formacao_cohorts")
    .delete()
    .eq("escola_id", auth.escolaId)
    .eq("id", id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
