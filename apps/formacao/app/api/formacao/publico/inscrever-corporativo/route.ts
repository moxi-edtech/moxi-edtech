import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callAuthAdminJob } from "@/lib/auth-admin-job";
import { sendMail, buildFormacaoCredentialsEmail } from "@/lib/mailer";

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

    const body = await request.json();
    const { nome, email, bi_numero, telefone, escola_id, cohort_id, fatura_id: contrato_id } = body;

    // 1. Re-validar o token e a quota no servidor (Segurança)
    const { data: contrato, error: fError } = await supabase
      .from("formacao_contratos_b2b")
      .select("b2b_token, vagas_compradas, vagas_utilizadas, status")
      .eq("id", contrato_id)
      .single();

    if (fError || !contrato || contrato.status !== "PAGO") {
      return NextResponse.json({ ok: false, error: "Contrato corporativo inválido ou não pago." }, { status: 400 });
    }

    if (contrato.vagas_utilizadas >= contrato.vagas_compradas) {
      return NextResponse.json({ ok: false, error: "Limite de vagas da empresa atingido." }, { status: 400 });
    }

    // 2. Criar Usuário no Auth (se não existir)
    const foundData = (await callAuthAdminJob(request, "findUserByEmail", { email })) as
      | { user?: { id?: string | null } | null }
      | null;
    let tempPass = Math.random().toString(36).slice(-10) + "!";
    let userId = foundData?.user?.id ?? null;

    if (!userId) {
      const createdData = (await callAuthAdminJob(request, "createUser", {
        email,
        password: tempPass,
        email_confirm: true,
        user_metadata: { nome, role: "formando", escola_id, tenant_type: "formacao" }
      })) as { user?: { id?: string | null } | null } | null;
      userId = createdData?.user?.id ?? null;
      if (!userId) throw new Error("Falha ao criar utilizador");
    }

    // 3. Executar Matrícula Oficial (RPC)
    const { error: mError } = await supabase.rpc("formacao_create_inscricao", {
      p_escola_id: escola_id,
      p_cohort_id: cohort_id,
      p_formando_user_id: userId,
      p_origem: "self_service",
      p_modalidade: "presencial",
      p_nome_snapshot: nome,
      p_email_snapshot: email,
      p_bi_snapshot: bi_numero,
      p_telefone_snapshot: telefone,
      p_valor_cobrado: 0 // Patrocinado
    });

    if (mError) throw mError;

    // 4. Atualizar Quota da Empresa (Incremental)
    await supabase
      .from("formacao_contratos_b2b")
      .update({ vagas_utilizadas: contrato.vagas_utilizadas + 1 })
      .eq("id", contrato_id);

    // 5. Enviar E-mail de Credenciais
    const { data: cohort } = await supabase.from("formacao_cohorts").select("nome, curso_nome").eq("id", cohort_id).single();
    const { data: escola } = await supabase.from("escolas").select("nome").eq("id", escola_id).single();

    if (cohort && escola) {
      const mailContent = buildFormacaoCredentialsEmail({
        nome,
        email,
        senha_temp: tempPass,
        escolaNome: escola.nome,
        cursoNome: cohort.curso_nome,
        cohortNome: cohort.nome,
      });
      await sendMail({ to: email, ...mailContent });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("Corporate Enrollment Error:", err);
    const message = err instanceof Error ? err.message : "Falha na inscrição corporativa";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
