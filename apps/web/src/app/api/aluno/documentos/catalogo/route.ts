import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx || !ctx.alunoId || !ctx.escolaId) {
      return NextResponse.json({ ok: false, error: "Contexto não encontrado" }, { status: 401 });
    }

    const { escolaId, alunoId } = ctx;

    // 1. Buscar catálogo de documentos da escola
    const { data: catalogo, error: catError } = await supabase
      .from("servicos_escola")
      .select("id, codigo, nome, descricao, valor_base, exige_pagamento_antes_de_liberar, exige_aprovacao")
      .eq("escola_id", escolaId)
      .eq("ativo", true)
      .ilike("codigo", "DOC_%")
      .order("nome", { ascending: true });

    if (catError) throw catError;

    // 2. Buscar pedidos e intenções
    const { data: pedidos, error: pedError } = await supabase
      .from("servico_pedidos")
      .select("id, status, servico_codigo, valor_cobrado, created_at, pagamento_intents(id, status, meta)")
      .eq("aluno_id", alunoId)
      .eq("escola_id", escolaId)
      .order("created_at", { ascending: false });

    if (pedError) throw pedError;

    // 3. Dados de pagamento da escola
    let dados_pagamento: any = null;
    const { data: escola } = await supabase.from('escolas').select('dados_pagamento').eq('id', escolaId).maybeSingle();
    if (escola?.dados_pagamento) {
      const raw = escola.dados_pagamento as Record<string, unknown>;
      dados_pagamento = {
        banco: typeof raw.banco === "string" ? raw.banco : null,
        iban: typeof raw.iban === "string" ? raw.iban : null,
        titular_conta: typeof raw.titular_conta === "string" ? raw.titular_conta : null,
        kwik_chave: typeof raw.kwik_chave === "string" ? raw.kwik_chave : null,
      };
    }

    // 4. Cruzar dados para o frontend
    const docs = catalogo.map((item) => {
      const pedido = pedidos?.find((p) => p.servico_codigo === item.codigo);
      const intent = (pedido?.pagamento_intents as any)?.[0];
      
      let status: any = pedido?.status || "available";
      if (intent?.status === 'pending') status = 'pending';
      else if (intent?.status === 'failed' || pedido?.status === 'canceled') status = 'rejected';

      return {
        ...item,
        pedido_id: pedido?.id || null,
        pagamento_intent_id: intent?.id || null,
        status,
        valor: item.valor_base,
        reject_reason: (intent?.meta as any)?.reject_reason || null,
      };
    });

    return NextResponse.json({ ok: true, documentos: docs, dados_pagamento });
  } catch (error: any) {
    console.error("[DocsCatalogo] Error:", error);
    return NextResponse.json({ ok: false, error: "Falha ao carregar catálogo" }, { status: 500 });
  }
}
