import { NextResponse } from "next/server";
import { getFechoCaixaData } from "@/lib/financeiro/fecho";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ... (existing GET handler)

const BodySchema = z.object({
  valor_declarado_especie: z.number(),
  valor_declarado_tpa: z.number(),
  valor_declarado_transferencia: z.number(),
});

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    }
    
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Payload inválido", issues: parsed.error.issues }, { status: 400 });
    }

    const { error: rpcError, data: rpcData } = await supabase.rpc("declarar_fecho_caixa", {
      p_escola_id: escolaId,
      p_valor_declarado_especie: parsed.data.valor_declarado_especie,
      p_valor_declarado_tpa: parsed.data.valor_declarado_tpa,
      p_valor_declarado_transferencia: parsed.data.valor_declarado_transferencia,
    });

    if (rpcError) {
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data: rpcData });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
