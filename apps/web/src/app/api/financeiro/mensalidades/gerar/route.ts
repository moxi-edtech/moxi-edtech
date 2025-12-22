import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/escola/disciplinas";

export async function POST(req: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const escolaId = String(body?.escolaId || "");
    const ano = Number(body?.ano);
    const mes = Number(body?.mes);
    const diaVencimento = body?.diaVencimento ? Number(body.diaVencimento) : undefined;

    if (!escolaId || !Number.isFinite(ano) || !Number.isFinite(mes)) {
      return NextResponse.json(
        { ok: false, error: "Parâmetros obrigatórios: escolaId, ano, mes" },
        { status: 400 }
      );
    }

    // Garantir vínculo do usuário com a escola
    const escolaDoUsuario = await resolveEscolaIdForUser(supabase as any, user.id);
    if (escolaDoUsuario && escolaDoUsuario !== escolaId) {
      return NextResponse.json(
        { ok: false, error: "Usuário não pertence a esta escola" },
        { status: 403 }
      );
    }

    const { data, error } = await supabase.rpc("gerar_mensalidades_lote", {
      p_escola_id: escolaId,
      p_ano_letivo: ano,
      p_mes_referencia: mes,
      p_dia_vencimento_default: diaVencimento,
    });

    if (error) {
      console.error("[mensalidades/gerar] Erro RPC:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? { ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[mensalidades/gerar] Erro inesperado:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
