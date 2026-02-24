// apps/web/src/app/api/financeiro/cobrancas/templates/route.ts
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
      .from("financeiro_templates_cobranca")
      .select("id, escola_id, nome, canal, corpo, criado_por, created_at")
      .eq("escola_id", escolaId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /templates] supabase error:", error);
      return NextResponse.json({ ok: false, error: error.message || "Erro ao buscar templates" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    console.error("[GET /templates] unexpected:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
