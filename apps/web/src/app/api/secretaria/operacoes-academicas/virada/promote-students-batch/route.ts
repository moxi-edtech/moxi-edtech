// @kf2 allow-scan
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const bodySchema = z.object({
  aluno_ids: z.array(z.string().uuid()).min(1).max(500),
  from_session_id: z.string().uuid(),
  to_session_id: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    const authz = await authorizeEscolaAction(supabase as any, escolaId, user.id, ["configurar_escola"]);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados do lote inválidos" }, { status: 400 });

    const alunoIds = Array.from(new Set(parsed.data.aluno_ids));
    const promoted: string[] = [];
    const reused: string[] = [];
    const failures: Array<{ aluno_id: string; error: string }> = [];

    for (const alunoId of alunoIds) {
      const { data, error } = await (supabase as any).rpc("promover_aluno_pos_pagamento", {
        p_escola_id: escolaId,
        p_aluno_id: alunoId,
        p_from_session_id: parsed.data.from_session_id,
        p_to_session_id: parsed.data.to_session_id,
      });

      if (error) {
        failures.push({ aluno_id: alunoId, error: error.message });
      } else if (data?.reused) {
        reused.push(alunoId);
      } else if (data?.ok) {
        promoted.push(alunoId);
      } else {
        failures.push({ aluno_id: alunoId, error: "Promoção não confirmada" });
      }
    }

    return NextResponse.json({
      ok: failures.length === 0,
      promoted,
      reused,
      failures,
      summary: {
        requested: alunoIds.length,
        promoted: promoted.length,
        reused: reused.length,
        failed: failures.length,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno" }, { status: 500 });
  }
}
