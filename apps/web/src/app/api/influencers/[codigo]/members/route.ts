import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ codigo: string }> }
) {
  try {
    const { codigo } = await context.params;
    const normalizedCode = codigo.trim().toUpperCase();
    if (!normalizedCode) {
      return NextResponse.json({ ok: false, error: "Código inválido." }, { status: 400 });
    }

    const supabase = await supabaseRouteClient();
    const { data, error } = await (supabase.rpc as any)("list_influencer_members_public", {
      p_codigo: normalizedCode,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: "Falha ao carregar membros." }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      members: Array.isArray(data) ? data : [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
