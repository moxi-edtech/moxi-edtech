import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { callAuthAdminJob } from "@/lib/auth-admin-job";
import { sendMail, buildFormacaoCredentialsEmail } from "@/lib/mailer";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const allowedRoles = ["formacao_admin", "formacao_secretaria", "super_admin", "global_admin"];

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const size = 12;
  let value = "";
  for (let i = 0; i < size; i += 1) {
    const idx = Math.floor(Math.random() * alphabet.length);
    value += alphabet[idx];
  }
  return value;
}

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = (await supabaseServer()) as FormacaoSupabaseClient;

  const { data, error } = await s
    .from("formacao_inscricoes_staging")
    .select(`
      *,
      cohort:formacao_cohorts (
        nome,
        curso_nome
      )
    `)
    .eq("escola_id", auth.escolaId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { id, action, reason } = body;

  if (!id || !["APROVAR", "REJEITAR"].includes(action)) {
    return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 });
  }

  const s = (await supabaseServer()) as FormacaoSupabaseClient;

  if (action === "REJEITAR") {
    const { error } = await s
      .from("formacao_inscricoes_staging")
      .update({ status: "REJEITADA" })
      .eq("id", id)
      .eq("escola_id", auth.escolaId);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // Se for APROVAR:
  const { data: staging, error: fetchErr } = await s
    .from("formacao_inscricoes_staging")
    .select("*")
    .eq("id", id)
    .eq("escola_id", auth.escolaId)
    .single();

  if (fetchErr || !staging) return NextResponse.json({ ok: false, error: "Inscrição não encontrada" }, { status: 404 });

  if (!staging.email) {
    return NextResponse.json({ ok: false, error: "Inscrição sem email não pode ser aprovada automaticamente" }, { status: 400 });
  }

  try {
    let generatedPassword: string | null = null;
    let createdNewUser = false;

    // 1. Verificar se o usuário já existe no Auth
    const authUserData = (await callAuthAdminJob(request, "findUserByEmail", {
      email: staging.email,
    })) as { user?: { id?: string | null } | null } | null;
    
    if (!authUserData?.user?.id) {
      // 2. Criar usuário se não existir
      generatedPassword = generateTemporaryPassword();
      await callAuthAdminJob(request, "createUser", {
        email: staging.email,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: {
          nome: staging.nome_completo,
          role: "formando",
          escola_id: auth.escolaId,
          tenant_type: "formacao",
        },
      });
      createdNewUser = true;
    }

    // 3. Atualizar Status para APROVADA (Isso dispara o Postgres Trigger tr_formacao_promote_staging)
    const { error: updateErr } = await s
      .from("formacao_inscricoes_staging")
      .update({ status: "APROVADA" })
      .eq("id", id);

    if (updateErr) throw updateErr;

    // 4. Se um novo usuário foi criado, enviar email de credenciais
    if (createdNewUser && generatedPassword) {
      try {
        const { data: cohortData } = await s
          .from("formacao_cohorts")
          .select("nome, curso_nome")
          .eq("id", staging.cohort_id)
          .single();
          
        const { data: escolaData } = await s
          .from("escolas")
          .select("nome")
          .eq("id", auth.escolaId)
          .single();

        if (cohortData && escolaData) {
          const emailContent = buildFormacaoCredentialsEmail({
            nome: staging.nome_completo,
            email: staging.email,
            senha_temp: generatedPassword,
            escolaNome: escolaData.nome,
            cursoNome: cohortData.curso_nome,
            cohortNome: cohortData.nome,
          });

          await sendMail({
            to: staging.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
          });
        }
      } catch (mailErr) {
        console.error("Erro ao enviar email de aprovação:", mailErr);
      }
    }

    return NextResponse.json({ 
      ok: true, 
      message: "Inscrição aprovada com sucesso. Usuário criado e matrícula oficial realizada." 
    });

  } catch (err: unknown) {
    console.error("Approval Flow Error:", err);
    const message = err instanceof Error ? err.message : "Falha ao aprovar inscrição";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
