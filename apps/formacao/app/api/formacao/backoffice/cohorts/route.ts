import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";
import { upsertCohortReferenceValue } from "@/lib/cohort-finance";

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
    curso_id?: string;
    curso_nome?: string;
    carga_horaria_total?: number;
    vagas?: number;
    data_inicio?: string;
    data_fim?: string;
    status?: "planeada" | "aberta" | "em_andamento" | "concluida" | "cancelada";
    formador_user_id?: string;
    percentual_honorario?: number;
    valor_referencia?: number;
  } | null;

  const codigo = String(body?.codigo ?? "").trim().toUpperCase();
  const nome = String(body?.nome ?? "").trim();
  const cursoId = String(body?.curso_id ?? "").trim();
  let cursoNome = String(body?.curso_nome ?? "").trim();
  let cargaHoraria = Number(body?.carga_horaria_total ?? 0);
  const vagas = Number(body?.vagas ?? 0);
  const dataInicio = String(body?.data_inicio ?? "").trim();
  const dataFim = String(body?.data_fim ?? "").trim();
  const status = body?.status ?? "planeada";
  const formadorUserId = String(body?.formador_user_id ?? "").trim();
  const percentualHonorario = Number(body?.percentual_honorario ?? 0);
  let valorReferenciaRaw = Number(body?.valor_referencia ?? NaN);
  const hasValorReferencia = Number.isFinite(valorReferenciaRaw);
  let valorReferencia = hasValorReferencia ? Math.max(0, valorReferenciaRaw) : null;

  if (!codigo || !nome || !dataInicio || !dataFim || vagas <= 0) {
    return NextResponse.json(
      { ok: false, error: "Preencha codigo, nome, curso, datas, carga horária e vagas" },
      { status: 400 }
    );
  }
  if (hasValorReferencia && valorReferenciaRaw < 0) {
    return NextResponse.json(
      { ok: false, error: "valor_referencia deve ser maior ou igual a zero" },
      { status: 400 }
    );
  }

  const s = auth.supabase as FormacaoSupabaseClient;
  let cursoModulosSnapshot: Array<{
    ordem: number;
    titulo: string;
    carga_horaria: number | null;
    descricao: string | null;
  }> = [];

  if (cursoId) {
    const { data: curso, error: cursoError } = await s
      .from("formacao_cursos")
      .select("id, nome, carga_horaria")
      .eq("escola_id", auth.escolaId)
      .eq("id", cursoId)
      .single();

    if (cursoError || !curso) {
      return NextResponse.json({ ok: false, error: "Curso selecionado não encontrado." }, { status: 400 });
    }

    cursoNome = String(curso.nome ?? "").trim();
    const cargaFromCurso = Number(curso.carga_horaria ?? 0);
    if (cargaFromCurso > 0) {
      cargaHoraria = cargaFromCurso;
    }

    if (valorReferencia == null) {
      const { data: comercial } = await s
        .from("formacao_curso_comercial")
        .select("preco_tabela")
        .eq("escola_id", auth.escolaId)
        .eq("curso_id", cursoId)
        .maybeSingle();
      const precoTabela = Number(comercial?.preco_tabela ?? 0);
      if (Number.isFinite(precoTabela) && precoTabela >= 0) {
        valorReferenciaRaw = precoTabela;
        valorReferencia = precoTabela;
      }
    }

    const { data: modulos, error: modulosError } = await s
      .from("formacao_curso_modulos")
      .select("ordem, titulo, carga_horaria, descricao")
      .eq("escola_id", auth.escolaId)
      .eq("curso_id", cursoId)
      .order("ordem", { ascending: true });

    if (modulosError) {
      return NextResponse.json({ ok: false, error: modulosError.message }, { status: 400 });
    }

    cursoModulosSnapshot = (modulos ?? []).map((modulo) => ({
      ordem: Number(modulo.ordem),
      titulo: String(modulo.titulo ?? "").trim(),
      carga_horaria: modulo.carga_horaria == null ? null : Number(modulo.carga_horaria),
      descricao: modulo.descricao ? String(modulo.descricao) : null,
    }));
  }

  if (!cursoNome || cargaHoraria <= 0) {
    return NextResponse.json(
      { ok: false, error: "Curso e carga horária são obrigatórios." },
      { status: 400 }
    );
  }

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

  if (data?.id && formadorUserId) {
    const honorario = Number.isFinite(percentualHonorario) && percentualHonorario > 0
      ? Math.min(percentualHonorario, 100)
      : 100;

    const { error: formadorError } = await s
      .from("formacao_cohort_formadores")
      .insert({
        escola_id: auth.escolaId,
        cohort_id: data.id,
        formador_user_id: formadorUserId,
        percentual_honorario: honorario,
      });

    if (formadorError) {
      return NextResponse.json(
        { ok: false, error: formadorError.message },
        { status: 400 }
      );
    }
  }

  if (data?.id && valorReferencia != null) {
    const { error: refError } = await upsertCohortReferenceValue(s, {
      escolaId: auth.escolaId as string,
      cohortId: data.id,
      userId: auth.userId as string,
      valorReferencia,
      moeda: "AOA",
    });

    if (refError) {
      return NextResponse.json({ ok: false, error: refError.message }, { status: 400 });
    }
  }

  if (data?.id && cursoId && cursoModulosSnapshot.length > 0) {
    const { error: snapshotError } = await s.from("formacao_cohort_modulos").insert(
      cursoModulosSnapshot.map((modulo) => ({
        escola_id: auth.escolaId,
        cohort_id: data.id,
        curso_id: cursoId,
        ...modulo,
      }))
    );

    if (snapshotError) {
      return NextResponse.json({ ok: false, error: snapshotError.message }, { status: 400 });
    }
  }

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
