import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const mensalidadeId = body?.mensalidade_id || body?.mensalidadeId;
    if (!mensalidadeId) return NextResponse.json({ ok: false, error: "mensalidade_id é obrigatório" }, { status: 400 });

    const { data, error } = await s.rpc("registrar_pagamento", {
      p_mensalidade_id: mensalidadeId,
      p_metodo_pagamento: body?.metodo_pagamento ?? "numerario",
      p_observacao: body?.observacao ?? "Pagamento via balcão",
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    const payload = (typeof data === "object" && data !== null) ? (data as { ok?: boolean; erro?: string }) : null;
    if (payload?.ok === false) {
      return NextResponse.json({ ok: false, error: payload.erro || "Falha ao registrar pagamento" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
