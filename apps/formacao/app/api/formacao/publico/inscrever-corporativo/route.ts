import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callAuthAdminJob } from "@/lib/auth-admin-job";
import { sendMail, buildFormacaoCredentialsEmail } from "@/lib/mailer";
import { z } from "zod";

export const dynamic = "force-dynamic";

const corporateEnrollmentSchema = z.object({
  nome: z.string().trim().min(3),
  email: z.string().trim().email(),
  bi_numero: z.string().trim().min(5),
  telefone: z.string().trim().min(6),
  escola_id: z.string().uuid(),
  cohort_id: z.string().uuid(),
  fatura_id: z.string().uuid(),
  b2b_token: z.string().trim().min(6),
});

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

    const rawBody = await request.json().catch(() => null);
    const parsed = corporateEnrollmentSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Payload inválido" }, { status: 400 });
    }
    const {
      nome,
      email,
      bi_numero,
      telefone,
      escola_id,
      cohort_id,
      fatura_id: contrato_id,
      b2b_token,
    } = parsed.data;

    // 1. Revalidar token/escopo/quota no servidor (Segurança)
    const { data: contrato, error: fError } = await supabase
      .from("formacao_contratos_b2b")
      .select("id, escola_id, cohort_id, b2b_token, vagas_compradas, vagas_utilizadas, status")
      .eq("id", contrato_id)
      .eq("b2b_token", b2b_token)
      .single();

    if (fError || !contrato || contrato.status !== "PAGO") {
      return NextResponse.json({ ok: false, error: "Contrato corporativo inválido ou não pago." }, { status: 400 });
    }

    if (contrato.escola_id !== escola_id || contrato.cohort_id !== cohort_id) {
      return NextResponse.json({ ok: false, error: "Escopo do contrato inválido para esta inscrição." }, { status: 403 });
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

    // 3. Executar matrícula + consumo de quota em transação atômica
    const { error: mError } = await supabase.rpc("formacao_corporate_enroll_atomic", {
      p_contrato_id: contrato.id,
      p_b2b_token: b2b_token,
      p_formando_user_id: userId,
      p_nome_snapshot: nome,
      p_email_snapshot: email,
      p_bi_snapshot: bi_numero,
      p_telefone_snapshot: telefone,
    });

    if (mError) throw mError;

    // 4. Enviar E-mail de Credenciais
    const { data: cohort } = await supabase
      .from("formacao_cohorts")
      .select("nome, curso_nome")
      .eq("id", contrato.cohort_id)
      .single();
    const { data: escola } = await supabase
      .from("escolas")
      .select("nome")
      .eq("id", contrato.escola_id)
      .single();

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
