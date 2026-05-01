import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { DBWithRPC } from "@/types/supabase-augment";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";
import { callAuthAdminJob } from "@/lib/auth-admin-job";
import { mapPapelToGlobalRole } from "@/lib/permissions";
import { buildCredentialsEmail, buildInviteEmail, sendMail } from "@/lib/mailer";

const emptyToNull = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
};

const normalizeWebsiteInput = (value: unknown) => {
  if (typeof value !== "string") return emptyToNull(value);
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const OptionalNullableString = z.preprocess(emptyToNull, z.string().trim().optional().nullable());
const OptionalNullableEmail = z.preprocess(
  emptyToNull,
  z.string().trim().email("Email inválido").optional().nullable()
);
const OptionalNullableUrl = z.preprocess(
  normalizeWebsiteInput,
  z.string().trim().url("URL inválida").optional().nullable()
);

const TeamMemberSchema = z.object({
  nome: z.string().trim().min(2, "Nome inválido"),
  email: z.string().trim().email("Email inválido").transform((value) => value.toLowerCase()),
  telefone: OptionalNullableString,
  papel: z.enum(["formacao_admin", "formacao_secretaria", "formacao_financeiro", "formador"]),
});

const ProvisionCentroSchema = z.object({
  tenant_type: z.enum(["formacao", "solo_creator"]).default("formacao"),
  centro: z.object({
    nome: z.string().trim().min(2),
    abrev: z.preprocess(emptyToNull, z.string().trim().max(20).optional().nullable()),
    morada: OptionalNullableString,
    municipio: OptionalNullableString,
    provincia: OptionalNullableString,
    telefone: OptionalNullableString,
    email: OptionalNullableEmail,
    website: OptionalNullableUrl,
  }),
  fiscal: z.object({
    nipc: OptionalNullableString,
    nif: OptionalNullableString,
    registo_maptess: OptionalNullableString,
    regime_iva: z.enum(["normal", "simplificado", "isento"]),
    moeda: z.string().trim().default("AOA"),
  }),
  perfil_formacao: z.object({
    areas_formacao: z.array(z.string().trim().min(1)).min(1),
    modalidades: z.array(z.enum(["presencial", "online", "hibrido"])).min(1),
    capacidade_max: z.number().int().positive().optional().nullable(),
    plano: z.enum(["basic", "pro", "enterprise"]),
  }),
  equipe_inicial: z.array(TeamMemberSchema).min(2),
  notas_admin: OptionalNullableString,
});

type CreateEscolaPayload = {
  ok?: boolean;
  escolaId?: string;
  escola_id?: string;
  escolaNome?: string;
  escola_nome?: string;
  [key: string]: unknown;
};

type FindUserByEmailResult = { user?: { id?: string } } | null;
type CreateAuthUserResult = { user?: { id?: string } } | null;
type UpdateUserByIdResult = { user?: { id?: string } } | null;

type TeamProvisionResult = {
  userId: string;
  email: string;
  papel: string;
  tempPassword: string | null;
  createdNew: boolean;
  emailStatus?: {
    attempted: boolean;
    ok: boolean;
    kind?: "credentials" | "invite";
    error?: string | null;
  };
};

export async function POST(request: Request) {
  try {
    const supabase = await supabaseServerTyped<DBWithRPC>();
    const supabaseUntyped = supabase as unknown as SupabaseClient;

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { data: roles } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const role = (roles?.[0] as { role?: string } | undefined)?.role;
    if (!isSuperAdminRole(role)) {
      return NextResponse.json({ ok: false, error: "Somente Super Admin" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = ProvisionCentroSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        {
          ok: false,
          error: issue?.message ?? "Payload inválido",
          field: issue?.path?.join(".") ?? null,
        },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const isSolo = payload.tenant_type === "solo_creator";

    const hasAdmin = payload.equipe_inicial.some((member) => member.papel === "formacao_admin");
    const hasSecretaria = payload.equipe_inicial.some(
      (member) => member.papel === "formacao_secretaria"
    );

    if (!isSolo && (!hasAdmin || !hasSecretaria)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Equipa inicial inválida. É obrigatório incluir pelo menos 1 formacao_admin e 1 formacao_secretaria.",
        },
        { status: 400 }
      );
    }

    const adminPrincipal =
      payload.equipe_inicial.find((member) => member.papel === "formacao_admin") ??
      payload.equipe_inicial[0];

    const createEscolaRes = await supabase.rpc("create_escola_with_admin", {
      p_nome: payload.centro.nome,
      p_nif: (payload.fiscal.nif ?? "").replace(/\D/g, ""),
      p_endereco: payload.centro.morada ?? "",
      p_admin_email: adminPrincipal.email,
      p_admin_telefone: normalizeTelefone(adminPrincipal.telefone),
      p_admin_nome: adminPrincipal.nome,
    });

    if (createEscolaRes.error) {
      return NextResponse.json(
        { ok: false, error: createEscolaRes.error.message || "Falha ao criar escola-base" },
        { status: 400 }
      );
    }

    const escolaPayload = normalizePayload(createEscolaRes.data);
    const escolaId = escolaPayload.escolaId || escolaPayload.escola_id;
    if (!escolaId) {
      return NextResponse.json(
        { ok: false, error: "Não foi possível determinar o ID do centro após provisionamento" },
        { status: 500 }
      );
    }

    const escolaPatch = await supabaseUntyped
      .from("escolas")
      .update({
        tenant_type: payload.tenant_type,
        plano_atual: mapCentroPlanToSchoolTier(payload.perfil_formacao.plano),
        status: "ativa",
      })
      .eq("id", escolaId);

    if (escolaPatch.error) {
      return NextResponse.json({ ok: false, error: escolaPatch.error.message }, { status: 400 });
    }

    const trialDays = await resolveFormacaoTrialDays(supabaseUntyped, payload.perfil_formacao.plano);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    const centroUpsert = await supabaseUntyped
      .from("centros_formacao")
      .upsert(
        {
          escola_id: escolaId,
          nome: payload.centro.nome,
          abrev: payload.centro.abrev ?? null,
          nipc: payload.fiscal.nipc ?? null,
          nif: payload.fiscal.nif ?? null,
          registo_maptess: payload.fiscal.registo_maptess ?? null,
          morada: payload.centro.morada ?? null,
          municipio: payload.centro.municipio ?? null,
          provincia: payload.centro.provincia ?? "Luanda",
          telefone: payload.centro.telefone ?? null,
          email: payload.centro.email ?? null,
          website: payload.centro.website ?? null,
          areas_formacao: payload.perfil_formacao.areas_formacao,
          modalidades: payload.perfil_formacao.modalidades,
          capacidade_max: payload.perfil_formacao.capacidade_max ?? null,
          status: "ativo",
          plano: payload.perfil_formacao.plano,
          subscription_status: "trial",
          trial_ends_at: trialEndsAt.toISOString(),
          moeda: payload.fiscal.moeda,
          regime_iva: payload.fiscal.regime_iva,
          notas_admin: payload.notas_admin ?? null,
          provisionado_por: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "escola_id" }
      );

    if (centroUpsert.error) {
      return NextResponse.json({ ok: false, error: centroUpsert.error.message }, { status: 400 });
    }

    const provisionados: TeamProvisionResult[] = [];
    for (const member of payload.equipe_inicial) {
      const result = await ensureTeamMember({
        req: request,
        supabaseUntyped,
        escolaId,
        nome: member.nome,
        email: member.email,
        telefone: member.telefone ?? null,
        papel: member.papel,
      });

      const origin = new URL(request.url).origin;
      const loginUrl = (process.env.KLASSE_AUTH_URL?.trim() || `${origin}/login`).replace(/\/$/, "");
      const emailDisplayRole = member.papel.replace(/^formacao_/, "");
      if (result.createdNew && result.tempPassword) {
        const mail = buildCredentialsEmail({
          nome: member.nome,
          email: member.email,
          senha_temp: result.tempPassword,
          escolaNome: payload.centro.nome,
          loginUrl,
        });
        const sent = await sendMail({
          to: member.email,
          subject: mail.subject,
          html: String(mail.html),
          text: String(mail.text),
        });
        result.emailStatus = {
          attempted: true,
          ok: sent.ok,
          kind: "credentials",
          error: sent.ok ? null : sent.error,
        };
      } else {
        const mail = buildInviteEmail({
          escolaNome: payload.centro.nome,
          onboardingUrl: loginUrl,
          convidadoEmail: member.email,
          convidadoNome: member.nome,
          papel: emailDisplayRole,
        });
        const sent = await sendMail({
          to: member.email,
          subject: mail.subject,
          html: String(mail.html),
          text: String(mail.text),
        });
        result.emailStatus = {
          attempted: true,
          ok: sent.ok,
          kind: "invite",
          error: sent.ok ? null : sent.error,
        };
      }
      provisionados.push(result);
    }

    return NextResponse.json({
      ok: true,
      escolaId,
      centroNome: payload.centro.nome,
      provisionados,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro interno" },
      { status: 500 }
    );
  }
}

function normalizePayload(input: unknown): CreateEscolaPayload {
  if (typeof input === "string") {
    try {
      return JSON.parse(input) as CreateEscolaPayload;
    } catch {
      return {};
    }
  }

  if (input && typeof input === "object") {
    return input as CreateEscolaPayload;
  }

  return {};
}

function normalizeTelefone(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

function mapCentroPlanToSchoolTier(plan: "basic" | "pro" | "enterprise") {
  if (plan === "enterprise") return "premium";
  if (plan === "pro") return "profissional";
  return "essencial";
}

async function resolveFormacaoTrialDays(supabaseUntyped: any, plan: "basic" | "pro" | "enterprise") {
  const { data } = await supabaseUntyped
    .from("formacao_plan_settings")
    .select("trial_days")
    .eq("plan", plan)
    .maybeSingle();

  const days = Number((data as { trial_days?: number } | null)?.trial_days ?? 7);
  if (!Number.isFinite(days)) return 7;
  return Math.min(365, Math.max(0, Math.round(days)));
}

function generateStrongPassword(length = 12): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()-_=+[]{};:,.?";
  const all = upper + lower + numbers + symbols;

  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];

  let password = pick(upper) + pick(lower) + pick(numbers) + pick(symbols);
  while (password.length < length) {
    password += pick(all);
  }

  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

async function ensureTeamMember(params: {
  req: Request;
  supabaseUntyped: SupabaseClient;
  escolaId: string;
  nome: string;
  email: string;
  telefone: string | null;
  papel: "formacao_admin" | "formacao_secretaria" | "formacao_financeiro" | "formador";
}): Promise<TeamProvisionResult> {
  const email = params.email.toLowerCase();
  const role = mapPapelToGlobalRole(params.papel);

  let userId: string | null = null;
  let createdNew = false;
  let tempPassword: string | null = null;

  const found = (await callAuthAdminJob(params.req, "findUserByEmail", {
    email,
  })) as FindUserByEmailResult;

  userId = found?.user?.id ?? null;

  if (!userId) {
    tempPassword = generateStrongPassword();
    const created = (await callAuthAdminJob(params.req, "createUser", {
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        nome: params.nome,
        role,
        must_change_password: true,
      },
      app_metadata: {
        role,
        escola_id: params.escolaId,
        tenant_type: "formacao",
      },
    })) as CreateAuthUserResult;

    userId = created?.user?.id ?? null;
    createdNew = Boolean(userId);
  }

  if (!userId) {
    throw new Error(`Falha ao provisionar utilizador ${email}`);
  }

  await (callAuthAdminJob(params.req, "updateUserById", {
    userId,
    attributes: {
      app_metadata: {
        role,
        escola_id: params.escolaId,
        tenant_type: "formacao",
      },
    },
  }) as Promise<UpdateUserByIdResult>);

  const profileUpsert = await params.supabaseUntyped.from("profiles").upsert(
    {
      user_id: userId,
      email,
      nome: params.nome,
      telefone: normalizeTelefone(params.telefone),
      role,
      escola_id: params.escolaId,
      current_escola_id: params.escolaId,
    },
    { onConflict: "user_id" }
  );

  if (profileUpsert.error) {
    throw new Error(`Falha no profile de ${email}: ${profileUpsert.error.message}`);
  }

  const escolaUserUpsert = await params.supabaseUntyped.from("escola_users").upsert(
    {
      escola_id: params.escolaId,
      user_id: userId,
      papel: params.papel,
      tenant_type: "formacao",
    },
    { onConflict: "escola_id,user_id" }
  );

  if (escolaUserUpsert.error) {
    throw new Error(`Falha no vínculo de ${email}: ${escolaUserUpsert.error.message}`);
  }

  if (params.papel === "formacao_admin") {
    try {
      await callAuthAdminJob(params.req, "upsertEscolaAdministrador", {
        escolaAdministrador: {
          escola_id: params.escolaId,
          user_id: userId,
          cargo: "diretor_centro",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      throw new Error(`Falha ao registrar admin do centro (${email}): ${message}`);
    }
  }

  return {
    userId,
    email,
    papel: params.papel,
    tempPassword,
    createdNew,
  };
}
