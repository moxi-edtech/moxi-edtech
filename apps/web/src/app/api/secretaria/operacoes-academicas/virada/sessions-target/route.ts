// @kf2 allow-scan
// apps/web/src/app/api/secretaria/operacoes-academicas/virada/sessions-target/route.ts
import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });

    // 1. Obter o ano ativo
    const { data: anoAtivo } = await supabase
      .from("anos_letivos")
      .select("id, ano")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .maybeSingle();

    // 2. Obter potenciais destinos (anos futuros cadastrados ou criar sugestão)
    const { data: futuros } = await supabase
      .from("anos_letivos")
      .select("id, ano, ativo")
      .eq("escola_id", escolaId)
      .gt("ano", anoAtivo?.ano || 0)
      .order("ano", { ascending: true });

    // 3. Verificar se já houve clonagem para algum desses anos
    const { data: existingStructure } = await supabase
      .from("turmas")
      .select("session_id")
      .eq("escola_id", escolaId);
    
    const sessionsWithData = new Set((existingStructure ?? []).map((t) => t.session_id));

    return NextResponse.json({
      ok: true,
      current_session: anoAtivo,
      target_sessions: (futuros || []).map(s => ({
        ...s,
        has_data: sessionsWithData.has(s.id)
      }))
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
