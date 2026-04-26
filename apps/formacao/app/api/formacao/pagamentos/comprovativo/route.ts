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

    // 2. Registrar na tabela de staging ou criar uma nova tabela de quarentena para pagamentos?
    // Para simplificar e seguir o fluxo de admissões, vamos usar a mesma lógica de 'staging'
    // mas aplicada a pagamentos. 
    // Como ainda não temos uma 'formacao_pagamentos_staging', vamos atualizar o item diretamente para 'em_verificacao'
    // e guardar o link no metadata por agora, ou criar a tabela.
    
    // Melhor: Criar a tabela formacao_pagamentos_verificacao
    
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
