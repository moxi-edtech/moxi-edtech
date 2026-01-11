import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { intent_id, external_ref, proof_url } = body ?? {};

    if (!intent_id) {
      return NextResponse.json({ ok: false, error: "intent_id é obrigatório" }, { status: 400 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });
    }

    if (external_ref || proof_url) {
      const { error: updateError } = await supabase
        .from("finance_payment_intents")
        .update({
          external_ref: external_ref ?? null,
          proof_url: proof_url ?? null,
        })
        .eq("id", intent_id)
        .eq("escola_id", escolaId);

      if (updateError) {
        return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });
      }
    }

    const { data, error } = await supabase.rpc("finance_confirm_payment", {
      p_intent_id: intent_id,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, intent: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
