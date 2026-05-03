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

async function assertFormadorBelongsToCentro(client: FormacaoSupabaseClient, escolaId: string, userId: string) {
  const { data, error } = await client
    .from("escola_users")
    .select("user_id,papel")
    .eq("escola_id", escolaId)
    .eq("tenant_type", "formacao")
    .eq("user_id", userId)
    .in("papel", ["formador", "formacao_admin", "formacao_secretaria"])
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message, status: 400 };
  if (!data) {
    return {
      ok: false as const,
      error: "Formador não pertence a este centro. Cadastre-o primeiro em Equipa.",
      status: 400,
    };
  }
  return { ok: true as const };
}

export async function GET(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const cursoId = searchParams.get("curso_id")?.trim();

  const s = auth.supabase as FormacaoSupabaseClient;
  let query = s
    .from("formacao_cohorts")
    .select(
      "id, codigo, nome, curso_nome, carga_horaria_total, vagas, data_inicio, data_fim, status, visivel_na_landing, created_at, curso_id, turno, formacao_cursos(nome)"
    )
    .eq("escola_id", auth.escolaId);

  if (cursoId) {
    query = query.eq("curso_id", cursoId);
  }

  const { data, error } = await query
    .order("data_inicio", { ascending: false })
    .limit(300);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  // Map data to use real course name from join if available
  const items = (data ?? []).map((item: any) => ({
    ...item,
    curso_nome: item.formacao_cursos?.nome || item.curso_nome,
    formacao_cursos: undefined // clean up join object
  }));

  return NextResponse.json({ ok: true, items });
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
    visivel_na_landing?: boolean;
    formador_user_id?: string;
    percentual_honorario?: number;
    valor_referencia?: number;
    turno?: string;
  } | null;

  const codigo = String(body?.codigo ?? "").trim().toUpperCase();
  const nome = String(body?.nome ?? "").trim();
  const turno = body?.turno ? String(body.turno).trim().toLowerCase() : null;
  const cursoId = String(body?.curso_id ?? "").trim();
  let cursoNome = String(body?.curso_nome ?? "").trim();
  let cargaHoraria = Number(body?.carga_horaria_total ?? 0);
  const vagas = Number(body?.vagas ?? 0);
  const dataInicio = String(body?.data_inicio ?? "").trim();
  const dataFim = String(body?.data_fim ?? "").trim();
  const status = body?.status ?? "planeada";
  const visivelNaLanding = body?.visivel_na_landing ?? true;
  const formadorUserId = String(body?.formador_user_id ?? "").trim();
  const percentualHonorario = Number(body?.percentual_honorario ?? 0);
  let valorReferenciaRaw = Number(body?.valor_referencia ?? NaN);
  const hasValorReferencia = Number.isFinite(valorReferenciaRaw);
  let valorReferencia = hasValorReferencia ? Math.max(0, valorReferenciaRaw) : null;

  if (!cursoId) {
    return NextResponse.json(
      { ok: false, error: "A vinculação a um curso do catálogo é obrigatória para novas turmas." },
      { status: 400 }
    );
  }

  if (!codigo || !nome || !dataInicio || !dataFim || vagas <= 0) {
    return NextResponse.json(
      { ok: false, error: "Preencha codigo, nome, datas e vagas" },
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

  if (formadorUserId) {
    const formadorCheck = await assertFormadorBelongsToCentro(
      s,
      auth.escolaId as string,
      formadorUserId
    );
    if (!formadorCheck.ok) {
      return NextResponse.json({ ok: false, error: formadorCheck.error }, { status: formadorCheck.status });
    }
  }

  let cursoModulosSnapshot: Array<{
    ordem: number;
    titulo: string;
    carga_horaria: number | null;
    descricao: string | null;
  }> = [];

  let cursoMateriaisSnapshot: Array<{
    titulo: string;
    url: string;
    tipo: string;
  }> = [];

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

  // Modulos inheritance
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

  // Materiais inheritance
  const { data: materiais } = await s
    .from("formacao_curso_materiais")
    .select("titulo, url, tipo")
    .eq("escola_id", auth.escolaId)
    .eq("curso_id", cursoId);

  cursoMateriaisSnapshot = (materiais ?? []).map((m) => ({
    titulo: String(m.titulo),
    url: String(m.url),
    tipo: String(m.tipo),
  }));

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
      curso_id: cursoId,
      codigo,
      nome,
      turno,
      curso_nome: cursoNome,
      carga_horaria_total: cargaHoraria,
      vagas,
      data_inicio: dataInicio,
      data_fim: dataFim,
      status,
      visivel_na_landing: visivelNaLanding,
    })
    .select(
      "id, codigo, nome, curso_nome, carga_horaria_total, vagas, data_inicio, data_fim, status, visivel_na_landing, curso_id, turno"
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

  if (data?.id && cursoId && cursoMateriaisSnapshot.length > 0) {
    const { error: matError } = await s.from("formacao_cohort_materiais").insert(
      cursoMateriaisSnapshot.map((m) => ({
        escola_id: auth.escolaId,
        cohort_id: data.id,
        curso_id: cursoId,
        ...m,
      }))
    );

    if (matError) {
      return NextResponse.json({ ok: false, error: matError.message }, { status: 400 });
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
    curso_id?: string;
    curso_nome?: string;
    vagas?: number;
    data_inicio?: string;
    data_fim?: string;
    status?: "planeada" | "aberta" | "em_andamento" | "concluida" | "cancelada";
    visivel_na_landing?: boolean;
    turno?: string;
  } | null;

  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.nome === "string") patch.nome = body.nome.trim();
  if (typeof body?.turno === "string") patch.turno = body.turno.trim().toLowerCase();
  if (typeof body?.curso_nome === "string") patch.curso_nome = body.curso_nome.trim();
  if (body?.vagas !== undefined) {
    const vagas = Number(body.vagas);
    if (vagas <= 0) return NextResponse.json({ ok: false, error: "vagas deve ser maior que zero" }, { status: 400 });
    patch.vagas = vagas;
  }
  if (typeof body?.data_inicio === "string") patch.data_inicio = body.data_inicio.trim();
  if (typeof body?.data_fim === "string") patch.data_fim = body.data_fim.trim();
  if (body?.status && ["planeada", "aberta", "em_andamento", "concluida", "cancelada"].includes(body.status)) {
    patch.status = body.status;
  }
  if (typeof body?.visivel_na_landing === "boolean") {
    patch.visivel_na_landing = body.visivel_na_landing;
  }

  const s = auth.supabase as FormacaoSupabaseClient;

  // Handle curso_id linking (Rescue Tool)
  const cursoIdUpdate = body?.curso_id ? String(body.curso_id).trim() : null;
  if (cursoIdUpdate) {
    // Check if it was already linked
    const { data: current } = await s
      .from("formacao_cohorts")
      .select("curso_id")
      .eq("id", id)
      .single();
    
    if (current && !current.curso_id) {
      patch.curso_id = cursoIdUpdate;
      
      // Inherit modules and materials if not already present
      const { data: curso } = await s
        .from("formacao_cursos")
        .select("nome, carga_horaria")
        .eq("id", cursoIdUpdate)
        .single();
      
      if (curso) {
        patch.curso_nome = curso.nome;
        patch.carga_horaria_total = curso.carga_horaria;

        // Inherit modules
        const { data: modulos } = await s
          .from("formacao_curso_modulos")
          .select("ordem, titulo, carga_horaria, descricao")
          .eq("curso_id", cursoIdUpdate);
        
        if (modulos && modulos.length > 0) {
          await s.from("formacao_cohort_modulos").insert(
            modulos.map(m => ({
              escola_id: auth.escolaId,
              cohort_id: id,
              curso_id: cursoIdUpdate,
              ...m
            }))
          );
        }

        // Inherit materials
        const { data: materiais } = await s
          .from("formacao_curso_materiais")
          .select("titulo, url, tipo")
          .eq("curso_id", cursoIdUpdate);
        
        if (materiais && materiais.length > 0) {
          await s.from("formacao_cohort_materiais").insert(
            materiais.map(m => ({
              escola_id: auth.escolaId,
              cohort_id: id,
              curso_id: cursoIdUpdate,
              ...m
            }))
          );
        }
      }
    }
  }

  const { data, error } = await s
    .from("formacao_cohorts")
    .update(patch)
    .eq("escola_id", auth.escolaId)
    .eq("id", id)
    .select("id, codigo, nome, curso_nome, carga_horaria_total, vagas, data_inicio, data_fim, status, visivel_na_landing, curso_id, turno")
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
