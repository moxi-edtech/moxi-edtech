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
  const body = (await request.json().catch(() => null)) as SelfServicePayload | null;
  const via = body?.via;
  const centroSlug = normalizeString(body?.centro_slug);
  const cohortRef = normalizeString(body?.cohort_ref);
  const nome = normalizeString(body?.nome);
  const email = normalizeEmail(body?.email);
  const biNumero = normalizeString(body?.bi_numero);
  const telefone = normalizeString(body?.telefone);
  const password = normalizeString(body?.password);

  if (via !== "self_service") {
    return NextResponse.json({ ok: false, error: "via inválida" }, { status: 400 });
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

  const { data: inscricao, error: inscricaoError } = await rpcClient.rpc("formacao_self_service_create_inscricao", {
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
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
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
    next: {
      action: "login",
      message: "Inscrição concluída. Faça login para continuar no portal do formando.",
    },
  });
}
