import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";
import { parsePlanTier } from "@/config/plans";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user ?? null;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? undefined;
    const escolaId = await resolveEscolaIdForUser(
      supabase,
      user.id,
      null,
      metaEscolaId ? String(metaEscolaId) : null
    );
    if (!escolaId) {
      return NextResponse.json({ ok: true, escola: { nome: null, plano: null, status: null } });
    }

    const { data: escola, error } = await supabase
      .from("vw_escola_info" as any)
      .select("nome, plano_atual, status")
      .eq("escola_id", escolaId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const escolaData = escola as
      | { nome?: string | null; plano_atual?: string | null; status?: string | null }
      | null;

    return NextResponse.json({
      ok: true,
      escola: {
        nome: escolaData?.nome ?? null,
        plano: escolaData?.plano_atual ? parsePlanTier(escolaData.plano_atual) : null,
        status: escolaData?.status ?? null,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
