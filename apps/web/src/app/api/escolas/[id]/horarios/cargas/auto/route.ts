import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BodySchema = z.object({
  turma_id: z.string().uuid(),
  strategy: z.enum(["preset_then_default"]).default("preset_then_default"),
  overwrite: z.boolean().default(false),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const { id: escolaId } = await ctx.params;
    const escolaIdResolved = await resolveEscolaIdForUser(supabase as any, user.id, escolaId, escolaId);
    if (!escolaIdResolved) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });
    }

    const authz = await authorizeTurmasManage(supabase as any, escolaIdResolved, user.id);
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });
    }

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues?.[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const body = parsed.data;

    const { data: turmaCheck } = await supabase
      .from("turmas")
      .select("id")
      .eq("escola_id", escolaIdResolved)
      .eq("id", body.turma_id)
      .maybeSingle();
    if (!turmaCheck) {
      return NextResponse.json({ ok: false, error: "Turma não encontrada" }, { status: 404 });
    }

    const { data: candidatos } = await supabase
      .from("turma_disciplinas")
      .select("id, carga_horaria_semanal, entra_no_horario, curso_matriz:curso_matriz_id(carga_horaria_semanal, entra_no_horario)")
      .eq("escola_id", escolaIdResolved)
      .eq("turma_id", body.turma_id);

    const elegiveis = (candidatos || []).filter((row: any) => {
      const entra = row.entra_no_horario ?? row.curso_matriz?.entra_no_horario ?? true;
      const carga = row.carga_horaria_semanal ?? row.curso_matriz?.carga_horaria_semanal ?? 0;
      if (!entra) return false;
      if (body.overwrite) return true;
      return carga <= 0;
    });

    const { data, error } = await supabase.rpc("horario_auto_configurar_cargas", {
      p_escola_id: escolaIdResolved,
      p_turma_id: body.turma_id,
      p_strategy: body.strategy,
      p_overwrite: body.overwrite,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const updated = (data || []).length;
    const skipped = Math.max(0, elegiveis.length - updated);

    return NextResponse.json({
      ok: true,
      data: {
        updated,
        skipped,
        items: data || [],
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
