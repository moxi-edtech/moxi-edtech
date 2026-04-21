import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { canManageEscolaResources } from "../../../permissions";

const payloadSchema = z.object({
  override: z.boolean(),
  modelo_id: z.string().uuid().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string; cursoId: string }> }
) {
  const { id: escolaId, cursoId } = await context.params;
  const supabase = await createRouteClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

  const userEscolaId = await resolveEscolaIdForUser(supabase, user.id, escolaId);
  if (!userEscolaId) {
    return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
  }

  const allowed = await canManageEscolaResources(supabase, escolaId, user.id);
  if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

  const { data: config } = await supabase
    .from("configuracoes_escola")
    .select("modelo_avaliacao")
    .eq("escola_id", userEscolaId)
    .maybeSingle();

  const { data: modelos, error: modelosError } = await supabase
    .from("modelos_avaliacao")
    .select("id, nome, curso_id, formula, regras, componentes, is_default")
    .eq("escola_id", userEscolaId)
    .or(`curso_id.is.null,curso_id.eq.${cursoId}`)
    .order("updated_at", { ascending: false });

  if (modelosError) {
    return NextResponse.json({ ok: false, error: modelosError.message }, { status: 400 });
  }

  const courseDefault = (modelos ?? []).find(
    (modelo) => modelo.curso_id === cursoId && modelo.is_default
  );
  const globalDefault = (modelos ?? []).find((modelo) => {
    if (!config?.modelo_avaliacao) return modelo.is_default && !modelo.curso_id;
    return modelo.id === config.modelo_avaliacao || modelo.nome === config.modelo_avaliacao;
  });

  return NextResponse.json({
    ok: true,
    data: {
      global_default: globalDefault ?? null,
      course_default: courseDefault ?? null,
      modelos: modelos ?? [],
    },
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; cursoId: string }> }
) {
  const { id: escolaId, cursoId } = await context.params;
  const supabase = await createRouteClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

  const userEscolaId = await resolveEscolaIdForUser(supabase, user.id, escolaId);
  if (!userEscolaId) {
    return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
  }

  const allowed = await canManageEscolaResources(supabase, escolaId, user.id);
  if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  const { override, modelo_id: modeloId } = parsed.data;

  if (!override) {
    const { error: clearError } = await supabase
      .from("modelos_avaliacao")
      .update({ is_default: false })
      .eq("escola_id", userEscolaId)
      .eq("curso_id", cursoId);

    if (clearError) {
      return NextResponse.json({ ok: false, error: clearError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data: { course_default: null } });
  }

  if (!modeloId) {
    return NextResponse.json({ ok: false, error: "Modelo não informado." }, { status: 400 });
  }

  const { data: modelo, error: modeloError } = await supabase
    .from("modelos_avaliacao")
    .select("id, nome, curso_id, formula, regras, componentes")
    .eq("escola_id", userEscolaId)
    .eq("id", modeloId)
    .maybeSingle();

  if (modeloError || !modelo) {
    return NextResponse.json({ ok: false, error: "Modelo não encontrado." }, { status: 404 });
  }

  if (modelo.curso_id && modelo.curso_id !== cursoId) {
    return NextResponse.json({ ok: false, error: "Modelo pertence a outro curso." }, { status: 400 });
  }

  let courseModelId = modelo.id;
  if (!modelo.curso_id) {
    const { data: created, error: createError } = await supabase
      .from("modelos_avaliacao")
      .insert({
        escola_id: escolaId,
        nome: `${modelo.nome} (Curso)`,
        curso_id: cursoId,
        formula: modelo.formula,
        regras: modelo.regras,
        componentes: modelo.componentes,
        is_default: true,
      })
      .select("id")
      .single();

    if (createError || !created) {
      return NextResponse.json({ ok: false, error: createError?.message || "Falha ao clonar modelo." }, { status: 400 });
    }
    courseModelId = created.id;
  }

  const { error: updateError } = await supabase
    .from("modelos_avaliacao")
    .update({ is_default: false })
    .eq("escola_id", userEscolaId)
    .eq("curso_id", cursoId)
    .neq("id", courseModelId);

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });
  }

  if (modelo.curso_id) {
    const { error: setDefaultError } = await supabase
      .from("modelos_avaliacao")
      .update({ is_default: true })
      .eq("id", courseModelId)
      .eq("escola_id", userEscolaId);
    if (setDefaultError) {
      return NextResponse.json({ ok: false, error: setDefaultError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, data: { course_default_id: courseModelId } });
}
