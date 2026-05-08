import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await params;
  try {
    const supabase = await createRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const userEscolaId = await resolveEscolaIdForUser(
      supabase as any,
      user.id,
      escolaId
    );

    if (!userEscolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    // Call the new RPC for pedagogical health stats
    const { data, error } = await (supabase as any).rpc("get_turmas_pedagogico_stats", {
      p_escola_id: userEscolaId,
    });

    if (error) {
      console.error("Error fetching pedagogical stats:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Map the RPC results to a more convenient structure for the frontend if needed
    // The RPC already returns: turma_id, media_presenca, media_notas, alumnos_abaixo_presenca, alumnos_abaixo_notas, is_desescoberta, decomposicao_saude
    
    return NextResponse.json({ 
      ok: true, 
      items: data || [] 
    });

  } catch (e: any) {
    console.error("Unexpected error in pedagogical stats API:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Erro inesperado" }, { status: 500 });
  }
}
