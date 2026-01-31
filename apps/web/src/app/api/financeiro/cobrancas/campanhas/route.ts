// apps/web/src/app/api/financeiro/cobrancas/campanhas/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });

    const { data, error } = await supabase
      .from("financeiro_campanhas_cobranca")
      .select("*")
      .eq("escola_id", escolaId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /campanhas] supabase error:", error);
      return NextResponse.json({ ok: false, error: error.message || "Erro ao buscar campanhas" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    console.error("[GET /campanhas] unexpected:", err);
    return NextResponse.json({ ok: false, error: err?.message || "Erro interno" }, { status: 500 });
  }
}