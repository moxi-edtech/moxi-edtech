import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "Campaign id missing" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ error: "Escola não identificada" }, { status: 403 });

    // Verify campaign belongs to escola and is not already finished
    const { data: existing, error: fetchErr } = await supabase
      .from("financeiro_campanhas_cobranca")
      .select("*")
      .eq("id", id)
      .eq("escola_id", escolaId)
      .single();

    if (fetchErr) {
      console.error("fetch campaign error:", fetchErr);
      return NextResponse.json({ error: fetchErr.message || "Erro ao buscar campanha" }, { status: 500 });
    }
    if (!existing) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
    if (existing.status === "finalizada") return NextResponse.json({ error: "Campanha já finalizada" }, { status: 400 });

    const { data: updated, error: updErr } = await supabase
      .from("financeiro_campanhas_cobranca")
      .update({
        status: "ativa",
        data_envio: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("escola_id", escolaId)
      .select("*")
      .single();

    if (updErr) {
      console.error("start campaign error:", updErr);
      return NextResponse.json({ error: updErr.message || "Erro ao iniciar campanha" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, campaign: updated });
  } catch (e: any) {
    console.error("iniciar campanha unexpected:", e);
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500 });
  }
}