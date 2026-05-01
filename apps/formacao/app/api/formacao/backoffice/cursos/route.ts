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

type CursoModuloPayload = {
  titulo?: string;
  carga_horaria?: number | null;
  descricao?: string | null;
};

function sanitizeModulos(modulos: CursoModuloPayload[] | null | undefined) {
  if (!Array.isArray(modulos)) return [];
  return modulos
    .map((modulo, index) => {
      const titulo = String(modulo?.titulo ?? "").trim();
      const descricao = String(modulo?.descricao ?? "").trim() || null;
      const carga = modulo?.carga_horaria == null ? null : Number(modulo.carga_horaria);
      const cargaHoraria =
        typeof carga === "number" && Number.isFinite(carga) && carga > 0 ? Math.floor(carga) : null;
      return {
        ordem: index + 1,
        titulo,
        descricao,
        carga_horaria: cargaHoraria,
      };
    })
    .filter((modulo) => modulo.titulo.length > 0);
}

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;
  const { data: cursos, error: cursosError } = await s
    .from("formacao_cursos")
    .select("id, codigo, nome, area, modalidade, carga_horaria, status, thumbnail_url, certificado_template_id, objetivos, requisitos, created_at")
    .eq("escola_id", auth.escolaId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (cursosError) return NextResponse.json({ ok: false, error: cursosError.message }, { status: 400 });

  const cursoIds = (cursos ?? []).map((curso) => String(curso.id));
  if (cursoIds.length === 0) return NextResponse.json({ ok: true, items: [] });

  const [
    { data: comerciais, error: comerciaisError },
    { data: modulos, error: modulosError },
    { data: materiais, error: materiaisError },
  ] = await Promise.all([
    s
      .from("formacao_curso_comercial")
      .select("curso_id, preco_tabela, desconto_ativo, desconto_percentual, parceria_b2b_ativa, custo_hora_estimado")
      .eq("escola_id", auth.escolaId)
      .in("curso_id", cursoIds),
    s
      .from("formacao_curso_modulos")
      .select("curso_id, ordem, titulo, carga_horaria, descricao")
      .eq("escola_id", auth.escolaId)
      .in("curso_id", cursoIds)
      .order("ordem", { ascending: true }),
    s
      .from("formacao_curso_materiais")
      .select("id, curso_id, titulo, url, tipo")
      .eq("escola_id", auth.escolaId)
      .in("curso_id", cursoIds),
  ]);

  if (comerciaisError) return NextResponse.json({ ok: false, error: comerciaisError.message }, { status: 400 });
  if (modulosError) return NextResponse.json({ ok: false, error: modulosError.message }, { status: 400 });
  if (materiaisError) return NextResponse.json({ ok: false, error: materiaisError.message }, { status: 400 });

  const comercialByCurso = new Map(
    (comerciais ?? []).map((item) => [
      String(item.curso_id),
      {
        preco_tabela: Number(item.preco_tabela ?? 0),
        desconto_ativo: Boolean(item.desconto_ativo),
        desconto_percentual: Number(item.desconto_percentual ?? 0),
        parceria_b2b_ativa: Boolean(item.parceria_b2b_ativa),
        custo_hora_estimado: Number(item.custo_hora_estimado ?? 0),
      },
    ])
  );

  const modulosByCurso = new Map<string, Array<{ ordem: number; titulo: string; carga_horaria: number | null; descricao: string | null }>>();
  for (const modulo of modulos ?? []) {
    const key = String(modulo.curso_id);
    const list = modulosByCurso.get(key) ?? [];
    list.push({
      ordem: Number(modulo.ordem),
      titulo: String(modulo.titulo),
      carga_horaria: modulo.carga_horaria == null ? null : Number(modulo.carga_horaria),
      descricao: modulo.descricao ? String(modulo.descricao) : null,
    });
    modulosByCurso.set(key, list);
  }

  const materiaisByCurso = new Map<string, Array<{ id: string; titulo: string; url: string; tipo: string }>>();
  for (const material of materiais ?? []) {
    const key = String(material.curso_id);
    const list = materiaisByCurso.get(key) ?? [];
    list.push({
      id: String(material.id),
      titulo: String(material.titulo),
      url: String(material.url),
      tipo: String(material.tipo),
    });
    materiaisByCurso.set(key, list);
  }

  const items = (cursos ?? []).map((curso) => {
    const key = String(curso.id);
    const comercial = comercialByCurso.get(key) ?? {
      preco_tabela: 0,
      desconto_ativo: false,
      desconto_percentual: 0,
      parceria_b2b_ativa: false,
      custo_hora_estimado: 0,
    };

    return {
      ...curso,
      ...comercial,
      modulos: modulosByCurso.get(key) ?? [],
      materiais: materiaisByCurso.get(key) ?? [],
    };
  });

  return NextResponse.json({ ok: true, items });
}

export async function POST(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    codigo?: string;
    nome?: string;
    area?: string;
    modalidade?: "presencial" | "online" | "hibrido";
    carga_horaria?: number;
    thumbnail_url?: string | null;
    certificado_template_id?: string | null;
    preco_tabela?: number;
    desconto_ativo?: boolean;
    desconto_percentual?: number;
    parceria_b2b_ativa?: boolean;
    custo_hora_estimado?: number;
    objetivos?: string[];
    requisitos?: string[];
    modulos?: CursoModuloPayload[];
    materiais?: Array<{ titulo: string; url: string; tipo: string }>;
  } | null;

  const codigo = String(body?.codigo ?? "").trim().toUpperCase();
  const nome = String(body?.nome ?? "").trim();
  const area = String(body?.area ?? "").trim() || null;
  const modalidadeRaw = String(body?.modalidade ?? "presencial").trim().toLowerCase();
  const modalidade = (["presencial", "online", "hibrido"].includes(modalidadeRaw)
    ? modalidadeRaw
    : "presencial") as "presencial" | "online" | "hibrido";
  const cargaHoraria =
    body?.carga_horaria && Number(body.carga_horaria) > 0 ? Number(body.carga_horaria) : null;
  const thumbnail_url = body?.thumbnail_url || null;
  const certificado_template_id = body?.certificado_template_id || null;
  const objetivos = Array.isArray(body?.objetivos) ? body.objetivos : [];
  const requisitos = Array.isArray(body?.requisitos) ? body.requisitos : [];

  const precoTabelaRaw = Number(body?.preco_tabela ?? 0);
  const precoTabela = Number.isFinite(precoTabelaRaw) ? Math.max(0, precoTabelaRaw) : 0;
  const descontoAtivo = Boolean(body?.desconto_ativo);
  const descontoPercentualRaw = Number(body?.desconto_percentual ?? 0);
  const descontoPercentual = Number.isFinite(descontoPercentualRaw)
    ? Math.min(100, Math.max(0, descontoPercentualRaw))
    : 0;
  const parceriaB2BAtiva = Boolean(body?.parceria_b2b_ativa);
  const custoHoraEstimado = Number.isFinite(Number(body?.custo_hora_estimado))
    ? Math.max(0, Number(body?.custo_hora_estimado))
    : 0;

  const modulos = sanitizeModulos(body?.modulos);
  const materiais = Array.isArray(body?.materiais) ? body.materiais : [];

  if (!codigo || !nome) {
    return NextResponse.json({ ok: false, error: "codigo e nome são obrigatórios" }, { status: 400 });
  }

  const s = auth.supabase as FormacaoSupabaseClient;
  const { data, error } = await s
    .from("formacao_cursos")
    .insert({
      escola_id: auth.escolaId,
      codigo,
      nome,
      area,
      modalidade,
      carga_horaria: cargaHoraria,
      thumbnail_url,
      certificado_template_id,
      objetivos,
      requisitos,
      status: "ativo",
    })
    .select("id, codigo, nome, area, modalidade, carga_horaria, thumbnail_url, certificado_template_id, objetivos, requisitos, status")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  if (!data?.id) {
    return NextResponse.json({ ok: false, error: "curso criado sem identificador" }, { status: 500 });
  }

  const { error: comercialError } = await s.from("formacao_curso_comercial").upsert(
    {
      escola_id: auth.escolaId,
      curso_id: data.id,
      preco_tabela: precoTabela,
      desconto_ativo: descontoAtivo,
      desconto_percentual: descontoPercentual,
      parceria_b2b_ativa: parceriaB2BAtiva,
      custo_hora_estimado: custoHoraEstimado,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "curso_id" }
  );
  if (comercialError) return NextResponse.json({ ok: false, error: comercialError.message }, { status: 400 });

  if (modulos.length > 0) {
    const { error: modulosError } = await s.from("formacao_curso_modulos").insert(
      modulos.map((modulo) => ({
        escola_id: auth.escolaId,
        curso_id: data.id,
        ...modulo,
      }))
    );
    if (modulosError) return NextResponse.json({ ok: false, error: modulosError.message }, { status: 400 });
  }

  if (materiais.length > 0) {
    const { error: materiaisError } = await s.from("formacao_curso_materiais").insert(
      materiais.map((m) => ({
        escola_id: auth.escolaId,
        curso_id: data.id,
        titulo: String(m.titulo).trim(),
        url: String(m.url).trim(),
        tipo: String(m.tipo || "pdf").trim(),
      }))
    );
    if (materiaisError) return NextResponse.json({ ok: false, error: materiaisError.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    item: {
      ...data,
      preco_tabela: precoTabela,
      desconto_ativo: descontoAtivo,
      desconto_percentual: descontoPercentual,
      parceria_b2b_ativa: parceriaB2BAtiva,
      custo_hora_estimado: custoHoraEstimado,
      modulos,
      materiais,
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    codigo?: string;
    nome?: string;
    area?: string | null;
    modalidade?: "presencial" | "online" | "hibrido";
    carga_horaria?: number | null;
    thumbnail_url?: string | null;
    certificado_template_id?: string | null;
    status?: "ativo" | "inativo";
    preco_tabela?: number;
    desconto_ativo?: boolean;
    desconto_percentual?: number;
    parceria_b2b_ativa?: boolean;
    custo_hora_estimado?: number;
    objetivos?: string[];
    requisitos?: string[];
    modulos?: CursoModuloPayload[];
    materiais?: Array<{ id?: string; titulo: string; url: string; tipo: string }>;
  } | null;

  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body?.codigo === "string") patch.codigo = body.codigo.trim().toUpperCase();
  if (typeof body?.nome === "string") patch.nome = body.nome.trim();
  if (body?.area !== undefined) patch.area = body.area ? String(body.area).trim() : null;
  if (body?.modalidade && ["presencial", "online", "hibrido"].includes(body.modalidade)) {
    patch.modalidade = body.modalidade;
  }
  if (body?.carga_horaria !== undefined) {
    const carga = body.carga_horaria === null ? null : Number(body.carga_horaria);
    if (carga !== null && carga <= 0) {
      return NextResponse.json({ ok: false, error: "carga_horaria deve ser maior que zero" }, { status: 400 });
    }
    patch.carga_horaria = carga;
  }
  if (body?.status && ["ativo", "inativo"].includes(body.status)) {
    patch.status = body.status;
  }
  if (body?.thumbnail_url !== undefined) {
    patch.thumbnail_url = body.thumbnail_url || null;
  }
  if (body?.certificado_template_id !== undefined) {
    patch.certificado_template_id = body.certificado_template_id || null;
  }
  if (body?.objetivos !== undefined) {
    patch.objetivos = Array.isArray(body.objetivos) ? body.objetivos : [];
  }
  if (body?.requisitos !== undefined) {
    patch.requisitos = Array.isArray(body.requisitos) ? body.requisitos : [];
  }

  const modulos = body?.modulos ? sanitizeModulos(body.modulos) : null;
  const materiais = Array.isArray(body?.materiais) ? body.materiais : null;

  const comercialPayload =
    body?.preco_tabela !== undefined ||
    body?.desconto_ativo !== undefined ||
    body?.desconto_percentual !== undefined ||
    body?.parceria_b2b_ativa !== undefined ||
    body?.custo_hora_estimado !== undefined
      ? {
          escola_id: auth.escolaId,
          curso_id: id,
          preco_tabela: Number.isFinite(Number(body?.preco_tabela))
            ? Math.max(0, Number(body?.preco_tabela))
            : 0,
          desconto_ativo: Boolean(body?.desconto_ativo),
          desconto_percentual: Number.isFinite(Number(body?.desconto_percentual))
            ? Math.min(100, Math.max(0, Number(body?.desconto_percentual)))
            : 0,
          parceria_b2b_ativa: Boolean(body?.parceria_b2b_ativa),
          custo_hora_estimado: Number.isFinite(Number(body?.custo_hora_estimado))
            ? Math.max(0, Number(body?.custo_hora_estimado))
            : 0,
          updated_at: new Date().toISOString(),
        }
      : null;

  const s = auth.supabase as FormacaoSupabaseClient;
  const { data, error } = await s
    .from("formacao_cursos")
    .update(patch)
    .eq("escola_id", auth.escolaId)
    .eq("id", id)
    .select("id, codigo, nome, area, modalidade, carga_horaria, thumbnail_url, certificado_template_id, objetivos, requisitos, status")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  if (comercialPayload) {
    const { error: comercialError } = await s
      .from("formacao_curso_comercial")
      .upsert(comercialPayload, { onConflict: "curso_id" });
    if (comercialError) return NextResponse.json({ ok: false, error: comercialError.message }, { status: 400 });
  }

  if (modulos) {
    const { error: deleteModulosError } = await s
      .from("formacao_curso_modulos")
      .delete()
      .eq("escola_id", auth.escolaId)
      .eq("curso_id", id);
    if (deleteModulosError) {
      return NextResponse.json({ ok: false, error: deleteModulosError.message }, { status: 400 });
    }

    if (modulos.length > 0) {
      const { error: insertModulosError } = await s.from("formacao_curso_modulos").insert(
        modulos.map((modulo) => ({
          escola_id: auth.escolaId,
          curso_id: id,
          ...modulo,
        }))
      );
      if (insertModulosError) {
        return NextResponse.json({ ok: false, error: insertModulosError.message }, { status: 400 });
      }
    }
  }

  if (materiais) {
    const { error: deleteMateriaisError } = await s
      .from("formacao_curso_materiais")
      .delete()
      .eq("escola_id", auth.escolaId)
      .eq("curso_id", id);
    if (deleteMateriaisError) {
      return NextResponse.json({ ok: false, error: deleteMateriaisError.message }, { status: 400 });
    }

    if (materiais.length > 0) {
      const { error: insertMateriaisError } = await s.from("formacao_curso_materiais").insert(
        materiais.map((m) => ({
          escola_id: auth.escolaId,
          curso_id: id,
          titulo: String(m.titulo).trim(),
          url: String(m.url).trim(),
          tipo: String(m.tipo || "pdf").trim(),
        }))
      );
      if (insertMateriaisError) {
        return NextResponse.json({ ok: false, error: insertMateriaisError.message }, { status: 400 });
      }
    }
  }

  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ ok: false, error: "id é obrigatório" }, { status: 400 });

  const s = auth.supabase as FormacaoSupabaseClient;
  const { error: deleteComercialError } = await s
    .from("formacao_curso_comercial")
    .delete()
    .eq("escola_id", auth.escolaId)
    .eq("curso_id", id);
  if (deleteComercialError) {
    return NextResponse.json({ ok: false, error: deleteComercialError.message }, { status: 400 });
  }

  const { error: deleteModulosError } = await s
    .from("formacao_curso_modulos")
    .delete()
    .eq("escola_id", auth.escolaId)
    .eq("curso_id", id);
  if (deleteModulosError) {
    return NextResponse.json({ ok: false, error: deleteModulosError.message }, { status: 400 });
  }

  const { error } = await s
    .from("formacao_cursos")
    .delete()
    .eq("escola_id", auth.escolaId)
    .eq("id", id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
