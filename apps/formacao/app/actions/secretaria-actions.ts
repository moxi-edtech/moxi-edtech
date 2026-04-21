"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { 
  aprovarInscricaoSchema, 
  rejeitarInscricaoSchema, 
  reenviarAcessoSchema 
} from "@/lib/validations/inscricoes";
import { sendMail, buildFormacaoCredentialsEmail } from "@/lib/mailer";
import { getFormacaoAuthContext } from "@/lib/auth-context";
import { supabaseServer } from "@/lib/supabaseServer";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateTempPassword() {
  return Math.random().toString(36).slice(-10) + "!";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Erro inesperado";
}

export async function aprovarInscricaoAction(formData: FormData) {
  const auth = await getFormacaoAuthContext();
  if (!auth?.escolaId) return { error: "Não autorizado" };
  const escolaId = auth.escolaId;

  const rawId = formData.get("id");
  const validation = aprovarInscricaoSchema.safeParse({ id: rawId });

  if (!validation.success) {
    return { error: "Payload inválido" };
  }

  const { id } = validation.data;
  const s = await supabaseServer();

  try {
    // 1. Buscar dados do staging
    const { data: staging, error: fetchErr } = await s
      .from("formacao_inscricoes_staging")
      .select("*")
      .eq("id", id)
      .eq("escola_id", escolaId)
      .single();

    if (fetchErr || !staging) return { error: "Inscrição não encontrada" };
    if (!staging.email) return { error: "Inscrição sem e-mail para criação de acesso" };

    // 2. Garantir existência do utilizador no Auth
    let tempPass = "";
    const { data: existingProfile } = await s
      .from("profiles")
      .select("user_id")
      .eq("email", staging.email)
      .maybeSingle();

    if (!existingProfile?.user_id) {
      tempPass = generateTempPassword();
      const { error: signUpError } = await supabaseAdmin.auth.admin.createUser({
        email: staging.email,
        password: tempPass,
        email_confirm: true,
        user_metadata: {
          nome: staging.nome_completo,
          role: "formando",
          escola_id: escolaId,
          tenant_type: "formacao",
        },
      });
      if (signUpError) throw signUpError;
    }

    // 3. Atualizar status (Dispara Trigger Postgres para promoção oficial)
    const { error: updateErr } = await s
      .from("formacao_inscricoes_staging")
      .update({ status: "APROVADA" })
      .eq("id", id);

    if (updateErr) throw updateErr;

    // 4. Enviar e-mail se for novo ou se tiver senha
    if (tempPass) {
      // Buscar nomes para o e-mail
      const { data: cohort } = await s.from("formacao_cohorts").select("nome, curso_nome").eq("id", staging.cohort_id).single();
      const { data: escola } = await s.from("escolas").select("nome").eq("id", escolaId).single();

      if (cohort && escola) {
        const mailContent = buildFormacaoCredentialsEmail({
          nome: staging.nome_completo,
          email: staging.email,
          senha_temp: tempPass,
          escolaNome: escola.nome,
          cursoNome: cohort.curso_nome,
          cohortNome: cohort.nome,
        });
        await sendMail({ to: staging.email, ...mailContent });
      }
    }

    revalidatePath("/secretaria/inbox");
    return { success: true, message: "Acesso libertado com sucesso." };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) || "Erro ao processar aprovação" };
  }
}

export async function rejeitarInscricaoAction(formData: FormData) {
  const auth = await getFormacaoAuthContext();
  if (!auth?.escolaId) return { error: "Não autorizado" };
  const escolaId = auth.escolaId;

  const validation = rejeitarInscricaoSchema.safeParse({
    id: formData.get("id"),
    motivo: formData.get("motivo"),
  });

  if (!validation.success) return { error: "Dados inválidos para rejeição" };

  const s = await supabaseServer();
  const { error } = await s
    .from("formacao_inscricoes_staging")
    .update({ status: "REJEITADA" })
    .eq("id", validation.data.id)
    .eq("escola_id", escolaId);

  if (error) return { error: error.message };

  revalidatePath("/secretaria/inbox");
  return { success: true, message: "Inscrição rejeitada." };
}

export async function aprovarPagamentoGlobalAction(formData: FormData) {
  const auth = await getFormacaoAuthContext();
  if (!auth?.escolaId) return { error: "Não autorizado" };
  const escolaId = auth.escolaId;

  const contratoId = formData.get("contrato_id") as string;
  const s = await supabaseServer();

  try {
    const { error } = await s
      .from("formacao_contratos_b2b")
      .update({ status: "PAGO" })
      .eq("id", contratoId)
      .eq("escola_id", escolaId);

    if (error) throw error;

    revalidatePath("/secretaria/inbox");
    return { success: true, message: "Pagamento corporativo confirmado. O Link Mágico está agora ativo para a empresa." };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function reenviarAcessoAction(formData: FormData) {
  const auth = await getFormacaoAuthContext();
  if (!auth?.escolaId) return { error: "Não autorizado" };
  const escolaId = auth.escolaId;

  const validation = reenviarAcessoSchema.safeParse({
    email: formData.get("email"),
    inscricao_id: formData.get("inscricao_id"),
  });

  if (!validation.success) return { error: "E-mail inválido" };

  const { email, inscricao_id } = validation.data;
  const s = await supabaseServer();

  try {
    let nome = "Formando(a)";
    let cohortNome = "Programa";
    let cursoNome = "Curso";

    const stagingQuery = s
      .from("formacao_inscricoes_staging")
      .select("nome_completo, cohort_id, created_at")
      .eq("escola_id", escolaId)
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1);

    const { data: staging } = inscricao_id
      ? await stagingQuery.eq("id", inscricao_id).maybeSingle()
      : await stagingQuery.maybeSingle();

    if (staging) {
      nome = staging.nome_completo || nome;
      if (staging.cohort_id) {
        const { data: cohort } = await s
          .from("formacao_cohorts")
          .select("nome, curso_nome")
          .eq("id", staging.cohort_id)
          .eq("escola_id", escolaId)
          .maybeSingle();
        if (cohort) {
          cohortNome = cohort.nome || cohortNome;
          cursoNome = cohort.curso_nome || cursoNome;
        }
      }
    } else {
      const inscricoesQuery = s
        .from("formacao_inscricoes")
        .select("nome_snapshot, cohort_id, created_at")
        .eq("escola_id", escolaId)
        .eq("email_snapshot", email)
        .order("created_at", { ascending: false })
        .limit(1);

      const { data: inscricao } = await inscricoesQuery.maybeSingle();
      if (inscricao) {
        nome = inscricao.nome_snapshot || nome;
        if (inscricao.cohort_id) {
          const { data: cohort } = await s
            .from("formacao_cohorts")
            .select("nome, curso_nome")
            .eq("id", inscricao.cohort_id)
            .eq("escola_id", escolaId)
            .maybeSingle();
          if (cohort) {
            cohortNome = cohort.nome || cohortNome;
            cursoNome = cohort.curso_nome || cursoNome;
          }
        }
      }
    }

    const { data: escola } = await s
      .from("escolas")
      .select("nome")
      .eq("id", escolaId)
      .maybeSingle();

    if (!escola?.nome) return { error: "Escola não encontrada" };

    const mailContent = buildFormacaoCredentialsEmail({
      nome,
      email,
      escolaNome: escola.nome,
      cursoNome,
      cohortNome,
    });

    const sent = await sendMail({ to: email, ...mailContent });
    if (!sent.ok) return { error: sent.error };

    revalidatePath("/secretaria/inbox");
    return { success: true, message: "Credenciais reenviadas com sucesso." };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) || "Falha ao reenviar credenciais." };
  }
}
