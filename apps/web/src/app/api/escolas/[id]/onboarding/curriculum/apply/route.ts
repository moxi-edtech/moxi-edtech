import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import {
  applyCurriculumPreset,
  type CurriculumApplyPayload,
} from "@/lib/academico/curriculum-apply";

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Next 15: params podem ser async -> await ctx.params

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: escolaId } = await ctx.params;
    const body = (await req.json()) as CurriculumApplyPayload;

    if (!escolaId || !body?.presetKey) {
      return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });
    }

    const result = await applyCurriculumPreset({
      supabase: supabaseAdmin,
      escolaId,
      presetKey: body.presetKey,
      customData: body.customData,
      advancedConfig: body.advancedConfig,
      createTurmas: true,
      anoLetivo: new Date().getFullYear(),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("[INSTALL] fatal:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Erro interno" },
      { status: 500 }
    );
  }
}
