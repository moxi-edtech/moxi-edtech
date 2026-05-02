import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import type { FormacaoSupabaseClient } from "@/lib/db-types";
import { sendMail, buildFormacaoCredentialsEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

type SelfServicePayload = {
  via?: "self_service";
  centro_slug?: string;
  cohort_ref?: string;
  nome?: string;
  email?: string;
  bi_numero?: string;
  telefone?: string;
  password?: string;
};

function maskEmail(value: string | null) {
  const email = String(value ?? "").trim();
  const [local, domain] = email.split("@");
  if (!local || !domain) return null;
  if (local.length <= 2) return `${local[0] ?? "*"}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

function normalizeString(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const centroSlug = normalizeString(url.searchParams.get("centro_slug"));
  const cohortRef = normalizeString(url.searchParams.get("cohort_ref"));
  if (!centroSlug || !cohortRef) {
    return NextResponse.json({ ok: false, error: "centro_slug e cohort_ref são obrigatórios" }, { status: 400 });
  }

  const s = (await supabaseServer()) as FormacaoSupabaseClient;
  const { data, error } = await (s as FormacaoSupabaseClient & {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc("formacao_self_service_resolve_target", {
    p_escola_slug: centroSlug,
    p_cohort_ref: cohortRef,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  const target = Array.isArray(data) ? data[0] : data;
  if (!target) {
    return NextResponse.json({ ok: false, error: "Turma não encontrada ou indisponível" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, target });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as (SelfServicePayload & { captcha_token?: string }) | null;
  const via = body?.via;
  const centroSlug = normalizeString(body?.centro_slug);
  const cohortRef = normalizeString(body?.cohort_ref);
  const nome = normalizeString(body?.nome);
  const email = normalizeEmail(body?.email);
  const biNumero = normalizeString(body?.bi_numero);
  const telefone = normalizeString(body?.telefone);
  const password = normalizeString(body?.password);
  const captchaToken = body?.captcha_token;

  if (via !== "self_service") {
    return NextResponse.json({ ok: false, error: "via inválida" }, { status: 400 });
  }

  // 1. Verificação de Captcha (Turnstile)
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY || "1x0000000000000000000000000000000AA"; // Secret de teste
  if (captchaToken) {
    const formData = new FormData();
    formData.append("secret", turnstileSecret);
    formData.append("response", captchaToken);

    const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      body: formData,
      method: "POST",
    });

    const outcome = await result.json();
    if (!outcome.success) {
      return NextResponse.json({ ok: false, error: "Falha na verificação de segurança (Captcha)." }, { status: 403 });
    }
  }

  if (!centroSlug || !cohortRef || !nome || !biNumero) {
    return NextResponse.json(
      { ok: false, error: "centro_slug, cohort_ref, nome e bi_numero são obrigatórios" },
      { status: 400 }
    );
  }

  const s = (await supabaseServer()) as FormacaoSupabaseClient;
  const rpcClient = s as FormacaoSupabaseClient & {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };

  const { data: precheckData, error: precheckError } = await rpcClient.rpc("formacao_self_service_precheck", {
    p_escola_slug: centroSlug,
    p_cohort_ref: cohortRef,
    p_bi_numero: biNumero,
  });

  if (precheckError) {
    const msg = precheckError.message.includes("TARGET_NOT_FOUND")
      ? "Turma não encontrada ou indisponível"
      : precheckError.message;
    return NextResponse.json({ ok: false, error: msg }, { status: 404 });
  }

  const precheck = Array.isArray(precheckData) ? precheckData[0] : precheckData;
  const existingUserId = normalizeString((precheck as { existing_user_id?: string | null } | null)?.existing_user_id);
  const existingEmail = normalizeEmail((precheck as { existing_email?: string | null } | null)?.existing_email);

  let formingUserId = "";
  let createdNewUser = false;

  if (existingUserId) {
    if (!password) {
      return NextResponse.json(
        {
          ok: false,
          code: "PASSWORD_REQUIRED",
          error: "Já encontramos um cadastro com este BI. Confirme sua senha para concluir a inscrição.",
          email_hint: maskEmail(existingEmail || email),
        },
        { status: 409 }
      );
    }

    const loginEmail = existingEmail || email;
    if (!loginEmail) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível resolver email para confirmação de senha." },
        { status: 409 }
      );
    }

    const { data: signInData, error: signInError } = await s.auth.signInWithPassword({
      email: loginEmail,
      password,
    });
    if (signInError || !signInData.user?.id) {
      return NextResponse.json({ ok: false, error: "Credenciais inválidas" }, { status: 401 });
    }
    if (String(signInData.user.id) !== existingUserId) {
      return NextResponse.json({ ok: false, error: "Credenciais inválidas" }, { status: 401 });
    }
    formingUserId = existingUserId;
  } else {
    if (!email) {
      return NextResponse.json({ ok: false, error: "email é obrigatório para novo cadastro" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: "senha deve ter no mínimo 8 caracteres" }, { status: 400 });
    }

    const { data: signUpData, error: signUpError } = await s.auth.signUp({
      email,
      password,
      options: {
        data: {
          nome,
          role: "formando",
          tenant_type: "formacao",
        },
      },
    });

    if (signUpError) {
      const msg = signUpError.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        return NextResponse.json(
          {
            ok: false,
            code: "ACCOUNT_EXISTS_USE_PASSWORD",
            error: "Conta já existente. Informe a senha para confirmar a inscrição.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ ok: false, error: signUpError.message }, { status: 400 });
    }

    const createdId = normalizeString(signUpData.user?.id);
    if (!createdId) {
      return NextResponse.json({ ok: false, error: "Não foi possível criar utilizador." }, { status: 400 });
    }

    formingUserId = createdId;
    createdNewUser = true;
  }

  const { data: inscricaoData, error: inscricaoError } = await rpcClient.rpc("formacao_self_service_create_inscricao", {
    p_escola_slug: centroSlug,
    p_cohort_ref: cohortRef,
    p_formando_user_id: formingUserId,
    p_nome: nome,
    p_email: email || existingEmail || null,
    p_bi_numero: biNumero,
    p_telefone: telefone || null,
  });

  if (inscricaoError) {
    if (inscricaoError.message.includes("BI_ALREADY_EXISTS")) {
      return NextResponse.json(
        {
          ok: false,
          code: "PASSWORD_REQUIRED",
          error: "Já encontramos um cadastro com este BI. Confirme sua senha para concluir a inscrição.",
          email_hint: maskEmail(existingEmail || email),
        },
        { status: 409 }
      );
    }
    if (inscricaoError.message.includes("TARGET_NOT_FOUND")) {
      return NextResponse.json({ ok: false, error: "Turma não encontrada ou indisponível" }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: inscricaoError.message }, { status: 400 });
  }

  const inscricao = Array.isArray(inscricaoData) ? inscricaoData[0] : (inscricaoData as { estado?: string } | null);
  const isWaitlist = (inscricao?.estado === "lista_espera");

  // Disparo de E-mail de Confirmação (Self-Service)
  if (createdNewUser && email) {
    try {
      const { data: targetData } = await s
        .from("escolas")
        .select(`
          id,
          nome,
          cohorts:formacao_cohorts (
            nome,
            curso_nome
          )
        `)
        .eq("slug", centroSlug)
        .eq("formacao_cohorts.codigo", cohortRef)
        .single();
        
      if (targetData && targetData.cohorts && targetData.cohorts.length > 0) {
        const cohortData = targetData.cohorts[0];
        const emailContent = buildFormacaoCredentialsEmail({
          nome,
          email,
          escolaNome: targetData.nome,
          cursoNome: cohortData.curso_nome,
          cohortNome: cohortData.nome,
        });

        await sendMail({
          to: email,
          subject: isWaitlist ? `LISTA DE ESPERA: ${targetData.nome} - ${cohortData.curso_nome}` : emailContent.subject,
          html: isWaitlist 
            ? `
              <div style="font-family: sans-serif; color: #334155; max-width: 600px;">
                <h1 style="color: #92400e;">Olá ${nome},</h1>
                <p style="font-size: 16px; line-height: 1.6;">
                  Registramos o seu interesse no curso <strong>${cohortData.curso_nome}</strong>. 
                  No momento, a turma <strong>${cohortData.nome}</strong> atingiu o limite máximo de ocupação.
                </p>
                <div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 12px; margin: 24px 0;">
                  <h2 style="margin-top: 0; color: #92400e; font-size: 18px;">⚠️ ATENÇÃO: NÃO REALIZE O PAGAMENTO</h2>
                  <p style="margin-bottom: 0; font-size: 14px;">
                    Como você está na <strong>Lista de Espera</strong>, pedimos que <strong>não faça nenhuma transferência bancária</strong> neste momento. 
                    Caso ocorra alguma desistência ou abertura de nova turma, nossa secretaria entrará em contacto direto consigo para autorizar o pagamento e garantir a sua vaga.
                  </p>
                </div>
                <p style="font-size: 14px; color: #64748b;">
                  Obrigado pela compreensão,<br>
                  Equipa ${targetData.nome}
                </p>
              </div>
            `
            : emailContent.html,
          text: isWaitlist 
            ? `Olá ${nome}, você está na lista de espera para o curso ${cohortData.curso_nome}. NÃO REALIZE O PAGAMENTO neste momento. Aguarde o contacto da nossa secretaria.`
            : emailContent.text,
        });
      }
    } catch (mailErr) {
      console.error("Falha ao enviar e-mail de confirmação (Self-Service):", mailErr);
    }
  }

  return NextResponse.json({
    ok: true,
    created_new_user: createdNewUser,
    inscricao,
    is_waitlist: isWaitlist,
    next: {
      action: isWaitlist ? "waitlist" : "login",
      message: isWaitlist 
        ? "Turma lotada! Você foi inserido na lista de espera. Entraremos em contacto em breve."
        : "Inscrição concluída. Faça login para continuar no portal do formando.",
    },
  });
}
