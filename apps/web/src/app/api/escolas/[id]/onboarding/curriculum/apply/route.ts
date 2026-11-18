import { NextRequest, NextResponse } from "next/server";
import {
  applyCurriculumPreset,
  type CurriculumApplyPayload,
} from "@/lib/academico/curriculum-apply";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { recordAuditServer } from "@/lib/audit";
import { K12_ADMIN_GESTAO_ROLE_GROUP } from "@/lib/roles";

// Next 15: params podem ser async -> await ctx.params

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: escolaId } = await ctx.params;
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const resolvedEscolaId = await resolveEscolaIdForUser(supabase, user.id, escolaId);
    if (!resolvedEscolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const { error: roleError } = await requireRoleInSchool({
      supabase,
      escolaId: resolvedEscolaId,
      roles: [...K12_ADMIN_GESTAO_ROLE_GROUP],
    });
    if (roleError) return roleError;

    const body = (await req.json()) as CurriculumApplyPayload;

    if (!escolaId || !body?.presetKey) {
      return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
    }

    // Uma sessão académica não pode ser deduzida do ano civil do servidor.
    // Este passo apenas prepara a matriz; publicação/geração usam o fluxo canónico.
    const requestedYear = body.sessionId?.trim() ?? "";
    if (requestedYear && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedYear)) {
      return NextResponse.json({ ok: false, error: "Ano letivo inválido." }, { status: 400 });
    }
    const queryYear = supabase
      .from("anos_letivos")
      .select("id,ano")
      .eq("escola_id", resolvedEscolaId);
    const { data: year, error: yearError } = requestedYear
      ? await queryYear.eq("id", requestedYear).maybeSingle()
      : await queryYear.eq("ativo", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (yearError || !year?.id || !Number.isInteger(Number(year.ano))) {
      return NextResponse.json({
        ok: false,
        error: "Seleccione um ano letivo da escola antes de aplicar o currículo.",
      }, { status: 409 });
    }

    const result = await applyCurriculumPreset({
      supabase,
      escolaId: resolvedEscolaId,
      presetKey: body.presetKey,
      customData: body.customData,
      advancedConfig: body.advancedConfig,
      createTurmas: false,
      createCurriculo: true,
      anoLetivo: Number(year.ano),
      anoLetivoId: year.id,
    });

    recordAuditServer({
      escolaId: resolvedEscolaId,
      portal: "admin_escola",
      acao: "CURRICULO_PRESET_APLICADO",
      entity: "curriculo",
      details: {
        presetKey: body.presetKey,
        createTurmas: false,
        anoLetivo: Number(year.ano),
        anoLetivoId: year.id,
        stats: result?.stats ?? null,
      },
    }).catch(() => null);

    return NextResponse.json({ ok: true, ...result, next_step: "publicar_curriculo_e_gerar_turmas" });
  } catch (e: any) {
    console.error("[INSTALL] fatal:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Erro interno" },
      { status: 500 }
    );
  }
}
