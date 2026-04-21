import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const supabaseUrl = String(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
    const supabaseAnonKey = String(
      process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
    ).trim();
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente" }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const formData = await request.formData();
    
    const escola_id = formData.get("escola_id") as string;
    const cohort_id = formData.get("cohort_id") as string;
    const nome_completo = formData.get("nome") as string;
    const bi_passaporte = formData.get("bi_numero") as string;
    const email = formData.get("email") as string;
    const telefone = formData.get("telefone") as string;
    const file = formData.get("file") as File;

    if (!escola_id || !cohort_id || !nome_completo || !bi_passaporte || !telefone || !file) {
      return NextResponse.json({ ok: false, error: "Dados incompletos" }, { status: 400 });
    }

    // 1. Upload do Comprovativo para o Storage
    const fileExt = file.name.split(".").pop();
    const fileName = `${escola_id}/${cohort_id}/${bi_passaporte}-${Date.now()}.${fileExt}`;
    const filePath = `comprovativos/${fileName}`;

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

    // Pegar URL pública do arquivo
    const { data: { publicUrl } } = supabase.storage
      .from("formacao-comprovativos")
      .getPublicUrl(filePath);

    // 2. Inserir na Tabela de Staging (Quarentena)
    const { error: insertError } = await supabase
      .from("formacao_inscricoes_staging")
      .insert({
        escola_id,
        cohort_id,
        nome_completo,
        bi_passaporte,
        email: email || null,
        telefone,
        comprovativo_url: publicUrl,
        status: "PENDENTE"
      });

    if (insertError) {
      console.error("Insert Error:", insertError);
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: "Inscrição enviada com sucesso!" });
  } catch (err) {
    console.error("Unexpected Error:", err);
    return NextResponse.json({ ok: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}
