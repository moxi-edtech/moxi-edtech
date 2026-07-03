import "server-only";

import type { DBWithRPC } from "@/types/supabase-augment";
import type { supabaseRouteClient } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";
import { z } from "zod";
import { buildCredentialsEmail, buildInviteEmail, buildOnboardingEmail, sendMail } from "@/lib/mailer";
import { parsePlanTier } from "@/config/plans";
import { callAuthAdminJob } from "@/lib/auth-admin-job";
import { mapPapelToGlobalRole } from "@/lib/permissions";
import { papelEscolaSchema, type PapelEscola } from "@/lib/roles";

export type CreateEscolaPayload = {
  ok?: boolean;
  escolaId?: string;
  escola_id?: string;
  escolaNome?: string;
  escola_nome?: string;
  mensagemAdmin?: string;
  [key: string]: unknown;
};

export const CreateEscolaBodySchema = z.object({
  nome: z.string().trim().min(1, "Nome da escola é obrigatório"),
  nif: z.string().trim().optional().nullable(),
  endereco: z.string().trim().optional().nullable(),
  plano: z.enum(["essencial", "profissional", "premium"]).optional().nullable(),
  admin: z
    .object({
      email: z.string().email("Email do administrador inválido").optional().nullable(),
      telefone: z.string().trim().optional().nullable(),
      nome: z.string().trim().optional().nullable(),
      papel: papelEscolaSchema.optional().nullable(),
    })
    .optional()
    .nullable(),
});

export type CreateEscolaBody = z.infer<typeof CreateEscolaBodySchema>;

type RouteSupabase = Awaited<ReturnType<typeof supabaseRouteClient<DBWithRPC>>>;

export type CreateSchoolCoreResult = {
  payload: CreateEscolaPayload;
  escolaId: string | null;
  escolaNome: string;
  adminEmail: string | null;
  adminTelefone: string | null;
  adminNome: string | null;
  adminPapel: PapelEscola;
};

export type StaffAccessEmailStatus = {
  attempted: boolean;
  ok: boolean;
  mode: "credentials" | "invite" | "none";
  error?: string | null;
};

export type StaffProvisionResult = {
  ok: boolean;
  email: string;
  nome: string | null;
  papel: PapelEscola;
  userId: string | null;
  createdNew: boolean;
  emailStatus: StaffAccessEmailStatus;
  error?: string | null;
};

export async function createSchoolCore(
  supabase: RouteSupabase,
  body: CreateEscolaBody
): Promise<CreateSchoolCoreResult> {
  const nif = body.nif ? body.nif.replace(/\D/g, "") : null;
  const adminEmail = body.admin?.email ? body.admin.email.trim().toLowerCase() : null;
  const adminTelefone = body.admin?.telefone ? body.admin.telefone.replace(/\D/g, "") : null;
  const adminNome = body.admin?.nome ? body.admin.nome.trim() : null;
  const adminPapel = (body.admin?.papel ?? "admin") as PapelEscola;

  const { data, error } = await supabase.rpc("create_escola_with_admin", {
    p_nome: body.nome,
    p_nif: nif ?? "",
    p_endereco: body.endereco ?? "",
    p_admin_email: adminEmail ?? "",
    p_admin_telefone: adminTelefone ?? "",
    p_admin_nome: adminNome ?? "",
  });

  if (error) {
    const msg = error.message || "Falha ao criar escola";
    const isRLS = /row-level security|RLS|permission/i.test(msg);
    const isValidation = /obrigatório|inválido|invalid|violates|duplicate/i.test(msg);
    const status = isRLS ? 403 : isValidation ? 400 : 500;
    throw new CreateSchoolError(msg, status);
  }

  const payload = (typeof data === "string" ? safeParseJSON(data) : data) as CreateEscolaPayload;
  const escolaId = payload?.escolaId || payload?.escola_id || null;
  const escolaNome = payload?.escolaNome || payload?.escola_nome || body.nome;

  if (escolaId && body.plano) {
    await supabase.from("escolas").update({ plano_atual: body.plano }).eq("id", escolaId);
  }

  return {
    payload,
    escolaId,
    escolaNome,
    adminEmail,
    adminTelefone,
    adminNome,
    adminPapel,
  };
}

export async function finalizeSchoolAdminAndEmails(
  request: Request,
  supabase: RouteSupabase,
  body: CreateEscolaBody,
  core: CreateSchoolCoreResult
) {
  const origin = new URL(request.url).origin;
  const actionLink = `${origin}`;
  const loginUrl = (process.env.KLASSE_AUTH_URL?.trim() || `${origin}/login`).replace(/\/$/, "");
  const escolaPlano = body.plano ? parsePlanTier(body.plano) : null;

  let adminPassword: string | null = null;
  let adminUserCreated = false;
  let adminError: string | null = null;

  if (core.adminEmail && core.escolaId) {
    try {
      const provision = await ensureStaffUser(request, supabase, {
        email: core.adminEmail,
        nome: core.adminNome,
        telefone: core.adminTelefone,
        escolaId: core.escolaId,
        papel: core.adminPapel,
      });
      adminPassword = provision.password;
      adminUserCreated = provision.createdNew;
    } catch (e: unknown) {
      adminError = e instanceof Error ? e.message : "Falha ao provisionar admin";
    }
  }

  let onboardingEmailStatus: { attempted: boolean; ok: boolean; error?: string | null } = { attempted: false, ok: false };
  if (core.adminEmail) {
    const { subject, html, text } = buildOnboardingEmail({
      escolaNome: core.escolaNome || "sua escola",
      onboardingUrl: actionLink,
      adminEmail: core.adminEmail,
      adminNome: core.adminNome || undefined,
      plano: escolaPlano || undefined,
    });
    const sent = await sendMail({ to: core.adminEmail, subject, html: String(html), text: String(text) });
    onboardingEmailStatus = { attempted: true, ok: sent.ok, error: sent.ok ? null : sent.error };
  }

  const accessEmailStatus = core.adminEmail
    ? await sendStaffAccessEmail({
        request,
        email: core.adminEmail,
        nome: core.adminNome,
        papel: core.adminPapel,
        escolaNome: core.escolaNome || body.nome,
        createdNew: adminUserCreated,
        password: adminPassword,
      })
    : { attempted: false, ok: false, mode: "none" as const };

  const credentialsEmailStatus =
    accessEmailStatus.mode === "credentials"
      ? { attempted: accessEmailStatus.attempted, ok: accessEmailStatus.ok, error: accessEmailStatus.error ?? null }
      : { attempted: false, ok: false, error: null };

  const inviteEmailStatus =
    accessEmailStatus.mode === "invite"
      ? { attempted: accessEmailStatus.attempted, ok: accessEmailStatus.ok, error: accessEmailStatus.error ?? null }
      : { attempted: false, ok: false, error: null };

  return {
    adminEmail: core.adminEmail,
    adminPassword,
    adminUserCreated,
    adminError,
    actionLink,
    emailStatus: {
      onboarding: onboardingEmailStatus,
      credentials: credentialsEmailStatus,
      invite: inviteEmailStatus,
    },
  };
}

export class CreateSchoolError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export async function provisionStaffContact(
  request: Request,
  supabase: RouteSupabase,
  params: { email: string; nome?: string | null; telefone?: string | null; escolaId: string; papel: PapelEscola; escolaNome?: string | null }
): Promise<StaffProvisionResult> {
  const email = params.email.trim().toLowerCase();
  const nome = params.nome?.trim() || null;

  try {
    const provision = await ensureStaffUser(request, supabase, {
      email,
      nome,
      telefone: params.telefone ?? null,
      escolaId: params.escolaId,
      papel: params.papel,
    });

    const emailStatus = await sendStaffAccessEmail({
      request,
      email,
      nome,
      papel: params.papel,
      escolaNome: params.escolaNome ?? null,
      createdNew: provision.createdNew,
      password: provision.password,
    });

    return {
      ok: true,
      email,
      nome,
      papel: params.papel,
      userId: provision.userId,
      createdNew: provision.createdNew,
      emailStatus,
    };
  } catch (error) {
    return {
      ok: false,
      email,
      nome,
      papel: params.papel,
      userId: null,
      createdNew: false,
      emailStatus: { attempted: false, ok: false, mode: "none", error: null },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function ensureStaffUser(
  req: Request,
  supabase: RouteSupabase,
  params: { email: string; nome?: string | null; telefone?: string | null; escolaId: string; papel: PapelEscola }
) {
  const email = params.email.toLowerCase();
  const telefone = params.telefone ? params.telefone.replace(/\D/g, "") : null;
  const role = mapPapelToGlobalRole(params.papel);

  const existing = await callAuthAdminJob(req, "findUserByEmail", { email });
  const existingUser = existing as { user?: { id?: string } } | null;
  let userId: string | null = existingUser?.user?.id || null;
  let password: string | null = null;
  let createdNew = false;

  if (!userId) {
    password = generateStrongPassword(12);
    const created = await callAuthAdminJob(req, "createUser", {
      email,
      password,
      email_confirm: true,
      user_metadata: { role, must_change_password: true, nome: params.nome ?? undefined },
      app_metadata: { role, escola_id: params.escolaId },
    });
    const createdUser = created as { user?: { id?: string } } | null;
    userId = createdUser?.user?.id ?? null;
    createdNew = true;
  }

  if (!userId) throw new Error("Não foi possível obter user_id para o admin");
  const ensuredUserId: string = userId;

  await callAuthAdminJob(req, "updateUserById", {
    userId: ensuredUserId,
    attributes: { app_metadata: { role, escola_id: params.escolaId } },
  }).catch(() => null);

  await supabase.from("profiles").upsert(
    {
      user_id: ensuredUserId,
      email,
      nome: params.nome ?? email,
      telefone,
      role: role as Database["public"]["Enums"]["user_role"],
      escola_id: params.escolaId,
      current_escola_id: params.escolaId,
    },
    { onConflict: "user_id" }
  );

  await supabase.from("escola_users").upsert(
    {
      escola_id: params.escolaId,
      user_id: ensuredUserId,
      papel: params.papel,
    },
    { onConflict: "escola_id,user_id" }
  );

  if (params.papel === "admin" || params.papel === "admin_escola" || params.papel === "staff_admin" || params.papel === "admin_financeiro") {
    await supabase.from("escola_administradores").upsert(
      {
        escola_id: params.escolaId,
        user_id: ensuredUserId,
        cargo: "administrador_principal",
      },
      { onConflict: "escola_id,user_id" }
    );
  }

  return { userId: ensuredUserId, createdNew, password };
}

async function sendStaffAccessEmail(args: {
  request: Request;
  email: string;
  nome?: string | null;
  papel: PapelEscola;
  escolaNome?: string | null;
  createdNew: boolean;
  password?: string | null;
}): Promise<StaffAccessEmailStatus> {
  const origin = new URL(args.request.url).origin;
  const loginUrl = (process.env.KLASSE_AUTH_URL?.trim() || `${origin}/login`).replace(/\/$/, "");

  if (args.createdNew && args.password) {
    const mail = buildCredentialsEmail({
      nome: args.nome ?? undefined,
      email: args.email,
      senha_temp: args.password,
      escolaNome: args.escolaNome ?? undefined,
      loginUrl,
    });
    const sent = await sendMail({
      to: args.email,
      subject: mail.subject,
      html: String(mail.html),
      text: String(mail.text),
    });
    return { attempted: true, ok: sent.ok, mode: "credentials", error: sent.ok ? null : sent.error };
  }

  const invite = buildInviteEmail({
    escolaNome: args.escolaNome ?? "sua escola",
    onboardingUrl: loginUrl,
    convidadoEmail: args.email,
    convidadoNome: args.nome ?? undefined,
    papel: args.papel,
  });
  const sent = await sendMail({
    to: args.email,
    subject: invite.subject,
    html: String(invite.html),
    text: String(invite.text),
  });
  return { attempted: true, ok: sent.ok, mode: "invite", error: sent.ok ? null : sent.error };
}

function generateStrongPassword(len = 12) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{};:,.?";
  let pwd = "";
  for (let i = 0; i < len; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

function safeParseJSON(input: string) {
  try {
    return JSON.parse(input);
  } catch {
    return { ok: false, error: "Resposta inválida do servidor" };
  }
}
