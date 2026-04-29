import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import { callAuthAdminJob } from "@/lib/auth-admin-job";
import { buildFormadorAccessEmail, sendMail } from "@/lib/mailer";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const allowedRoles = ["formacao_admin", "super_admin", "global_admin"];

type ProfileRow = {
  user_id: string;
  nome: string;
  email: string | null;
};

type RpcClient = {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

type LinkData = { properties?: { action_link?: string | null }; action_link?: string | null };

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

function stripTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function resolveFormacaoLoginUrl(request: Request) {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  if (configured) return `${stripTrailingSlash(configured)}/login`;

  const origin = new URL(request.url).origin;
  return `${stripTrailingSlash(origin)}/login`;
}

function resolveAuthResetRedirectUrl(request: Request) {
  const configuredAuthUrl = String(process.env.KLASSE_AUTH_URL ?? "").trim();
  if (configuredAuthUrl) {
    return `${stripTrailingSlash(configuredAuthUrl.replace(/\/login\/?$/, ""))}/reset-password`;
  }

  const configuredBase = String(
    process.env.KLASSE_AUTH_ADMIN_JOB_BASE_URL ?? process.env.KLASSE_K12_LOCAL_ORIGIN ?? ""
  ).trim();
  if (configuredBase) return `${stripTrailingSlash(configuredBase)}/reset-password`;

  const origin = new URL(request.url).origin;
  if (origin.includes("://formacao.lvh.me")) {
    return `${stripTrailingSlash(origin.replace("://formacao.lvh.me", "://app.lvh.me"))}/reset-password`;
  }
  if (origin.includes("://formacao.klasse.ao")) {
    return "https://app.klasse.ao/reset-password";
  }
  return `${stripTrailingSlash(origin)}/reset-password`;
}

function extractActionLink(raw: unknown) {
  const linkData = raw as LinkData | null;
  return linkData?.properties?.action_link || linkData?.action_link || null;
}

async function generateRecoveryLink(request: Request, email: string) {
  try {
    const raw = await callAuthAdminJob(request, "generateLink", {
      type: "recovery",
      email,
      options: { redirectTo: resolveAuthResetRedirectUrl(request) },
    });
    return { url: extractActionLink(raw), error: null as string | null };
  } catch (error) {
    return {
      url: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getFormadoresFromMemberships(client: FormacaoSupabaseClient, escolaId: string) {
  const { data, error } = await (client as unknown as RpcClient).rpc("formacao_formadores_por_centro", {
    p_escola_id: escolaId,
  });

  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return [] as ProfileRow[];

  return data
    .map((row) => {
      const parsed = row as { user_id?: string; nome?: string; email?: string | null };
      if (!parsed.user_id || !parsed.nome) return null;
      return {
        user_id: String(parsed.user_id),
        nome: String(parsed.nome),
        email: parsed.email ? String(parsed.email) : null,
      };
    })
    .filter((row): row is ProfileRow => Boolean(row));
}

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  try {
    const s = auth.supabase as FormacaoSupabaseClient;
    const items = await getFormadoresFromMemberships(s, auth.escolaId);
    return NextResponse.json({
      ok: true,
      items: items.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao carregar formadores" },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as
    | {
        nome?: string;
        email?: string;
        telefone?: string;
      }
    | null;

  const nome = String(body?.nome ?? "").trim();
  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();
  const telefone = String(body?.telefone ?? "").trim();

  if (!nome || !email) {
    return NextResponse.json({ ok: false, error: "nome e email são obrigatórios" }, { status: 400 });
  }

  try {
    const s = auth.supabase as FormacaoSupabaseClient;
    const { data: escola } = await s
      .from("escolas")
      .select("nome")
      .eq("id", auth.escolaId)
      .maybeSingle();
    const escolaNome = String((escola as { nome?: string | null } | null)?.nome ?? "Centro de Formação").trim();

    const existingData = (await callAuthAdminJob(request, "findUserByEmail", { email })) as
      | { user?: { id?: string | null } | null }
      | null;
    const existing = existingData?.user as
      | {
          id?: string | null;
          app_metadata?: Record<string, unknown> | null;
          user_metadata?: Record<string, unknown> | null;
        }
      | null;
    const tempPassword = generateTemporaryPassword();

    let userId = existing?.id ?? null;
    let createdNew = false;
    let recoveryUrl: string | null = null;
    let recoveryLinkError: string | null = null;

    // Verificar se já existe vínculo para evitar downgrade de papel
    const { data: existingMembership } = userId
      ? await s
          .from("escola_users")
          .select("papel")
          .eq("escola_id", auth.escolaId)
          .eq("user_id", userId)
          .maybeSingle()
      : { data: null };

    const currentPapel = existingMembership?.papel;
    const isAdministrative = currentPapel === "formacao_admin" || currentPapel === "formacao_secretaria";
    const targetRole = isAdministrative ? currentPapel : "formador";

    if (!userId) {
      const createdData = (await callAuthAdminJob(request, "createUser", {
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          nome,
          role: "formador",
          escola_id: auth.escolaId,
          tenant_type: "formacao",
          must_change_password: true,
        },
        app_metadata: {
          role: "formador",
          escola_id: auth.escolaId,
          tenant_type: "formacao",
        },
      })) as { user?: { id?: string | null } | null } | null;

      userId = createdData?.user?.id ?? null;
      if (!userId) throw new Error("Falha ao criar utilizador");
      createdNew = true;
    } else {
      await callAuthAdminJob(request, "updateUserById", {
        userId,
        attributes: {
          user_metadata: {
            ...(existing?.user_metadata ?? {}),
            nome,
            role: targetRole,
            escola_id: auth.escolaId,
            tenant_type: "formacao",
          },
          app_metadata: {
            ...(existing?.app_metadata ?? {}),
            role: targetRole,
            escola_id: auth.escolaId,
            tenant_type: "formacao",
          },
        },
      });

      const recovery = await generateRecoveryLink(request, email);
      recoveryUrl = recovery.url;
      recoveryLinkError = recovery.error;
    }

    await callAuthAdminJob(request, "upsertProfile", {
      profile: {
        user_id: userId,
        email,
        nome,
        telefone: telefone || null,
        role: targetRole,
        escola_id: auth.escolaId,
        current_escola_id: auth.escolaId,
      },
      onConflict: "user_id",
    });

    await callAuthAdminJob(request, "upsertEscolaUser", {
      escolaUser: {
        escola_id: auth.escolaId,
        user_id: userId,
        papel: targetRole,
        tenant_type: "formacao",
      },
    });

    const mailContent = buildFormadorAccessEmail({
      nome,
      email,
      escolaNome,
      senha_temp: createdNew ? tempPassword : null,
      recoveryUrl,
      loginUrl: resolveFormacaoLoginUrl(request),
      existingUser: !createdNew,
    });
    const mailResult = await sendMail({ to: email, ...mailContent });
    const emailSent = mailResult.ok;

    return NextResponse.json({
      ok: true,
      item: { user_id: userId, nome, email },
      created_new: createdNew,
      temporary_password: createdNew && !emailSent ? tempPassword : null,
      email_sent: emailSent,
      email_error: emailSent ? null : mailResult.error,
      recovery_link_generated: !createdNew ? Boolean(recoveryUrl) : null,
      recovery_link_error: recoveryLinkError,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao cadastrar formador" },
      { status: 400 }
    );
  }
}
