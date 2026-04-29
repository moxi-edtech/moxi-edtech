import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireFormacaoRoles(["formando"]);
    if (!auth.ok) return auth.response;
    const supabase = await supabaseServer();

    const formData = await request.formData();
    const item_id = formData.get("itemId") as string;
    const file = formData.get("file") as File;
    const valorInformado = formData.get("valorInformado") as string;
    const mensagem = formData.get("mensagem") as string;

    if (!item_id || !file) {
      return NextResponse.json({ ok: false, error: "Dados incompletos" }, { status: 400 });
    }

    // 1. Upload do Comprovativo
    const fileExt = file.name.split(".").pop();
    const fileName = `pagamentos/${auth.escolaId}/${auth.userId}/${item_id}-${Date.now()}.${fileExt}`;
    const filePath = `comprovativos-mensalidade/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("formacao-comprovativos")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload Error:", uploadError);
      return NextResponse.json({ ok: false, error: "Erro ao enviar comprovativo" }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from("formacao-comprovativos")
      .getPublicUrl(filePath);

    const { data: itemOwned, error: itemOwnedError } = await supabase
      .from("formacao_faturas_lote_itens")
      .select("id, escola_id, fatura_lote_id, status_pagamento")
      .eq("id", item_id)
      .eq("formando_user_id", auth.userId)
      .eq("escola_id", auth.escolaId)
      .maybeSingle();

    if (itemOwnedError || !itemOwned?.id) {
      return NextResponse.json({ ok: false, error: "Cobrança não encontrada para este utilizador" }, { status: 404 });
    }

    const { error: verifError } = await (supabase as any)
      .from("formacao_pagamentos_verificacao")
      .insert({
        escola_id: auth.escolaId,
        fatura_item_id: item_id,
        formando_user_id: auth.userId,
        comprovativo_url: publicUrl,
        valor_informado: valorInformado ? Number(valorInformado) : null,
        mensagem_aluno: mensagem || null,
        status: "submetido",
        metadata: {
          origem: "portal_formando",
          enviado_em: new Date().toISOString(),
          content_type: file.type || null,
          file_name: file.name || null,
        },
      });

    if (verifError) {
      return NextResponse.json({ ok: false, error: verifError.message }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("formacao_faturas_lote_itens")
      .update({
        status_pagamento: "em_verificacao",
        metadata: {
          comprovativo_url: publicUrl,
          valor_informado: valorInformado ? Number(valorInformado) : null,
          mensagem_aluno: mensagem || null,
          enviado_em: new Date().toISOString()
        }
      })
      .eq("id", item_id)
      .eq("formando_user_id", auth.userId);

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Unexpected Error:", err);
    return NextResponse.json({ ok: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}
