import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const bodySchema = z.object({
  aluno_id: z.string().uuid(),
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
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados do aluno inválidos" }, { status: 400 });

    const { data, error } = await (supabase as any).rpc("promover_aluno_pos_pagamento", {
      p_escola_id: escolaId,
      p_aluno_id: parsed.data.aluno_id,
      p_from_session_id: parsed.data.from_session_id,
      p_to_session_id: parsed.data.to_session_id,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    const { data: reclassificationSync, error: reclassificationSyncError } = await (supabase as any).rpc("sync_reclassificacoes_virada", {
      p_escola_id: escolaId,
      p_origem_session_id: parsed.data.from_session_id,
      p_destino_session_id: parsed.data.to_session_id,
    });
    return NextResponse.json({
      ok: true,
      result: data,
      reclassification_sync: reclassificationSyncError ? { ok: false, error: reclassificationSyncError.message } : reclassificationSync,
    });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno" }, { status: 500 });
  }
}
