import { NextRequest, NextResponse } from "next/server";
import {
  applyCurriculumPreset,
  type CurriculumApplyPayload,
} from "@/lib/academico/curriculum-apply";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";
import { recordAuditServer } from "@/lib/audit";

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
    if (!resolvedEscolaId || resolvedEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const { error: roleError } = await requireRoleInSchool({
      supabase,
      escolaId: resolvedEscolaId,
      roles: ["admin", "admin_escola", "staff_admin"],
    });
    if (roleError) return roleError;

    const body = (await req.json()) as CurriculumApplyPayload;

    if (!escolaId || !body?.presetKey) {
      return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
    }

    const result = await applyCurriculumPreset({
      supabase,
      escolaId,
      presetKey: body.presetKey,
      customData: body.customData,
      advancedConfig: body.advancedConfig,
      createTurmas: true,
      anoLetivo: new Date().getFullYear(),
    });

    recordAuditServer({
      escolaId,
      portal: "admin_escola",
      acao: "CURRICULO_PRESET_APLICADO",
      entity: "curriculo",
      details: {
        presetKey: body.presetKey,
        createTurmas: true,
        anoLetivo: new Date().getFullYear(),
        stats: result?.stats ?? null,
      },
    }).catch(() => null);

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("[INSTALL] fatal:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Erro interno" },
      { status: 500 }
    );
  }
}
