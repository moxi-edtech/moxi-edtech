// @kf2 allow-scan
// apps/web/src/app/api/secretaria/operacoes-academicas/virada/fix-sessions/route.ts
import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });

    // Chama a RPC de correção atômica
    const { data, error } = await supabase.rpc("fix_academic_session_ids", {
        p_escola_id: escolaId
    });

    if (error) throw error;

    return NextResponse.json({ ok: true, result: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro interno";
    console.error("[FIX-SESSIONS] Erro:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
