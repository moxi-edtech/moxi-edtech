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

  let credentialsEmailStatus: { attempted: boolean; ok: boolean; error?: string | null } = { attempted: false, ok: false };
  if (core.adminEmail && adminUserCreated && adminPassword) {
    const mail = buildCredentialsEmail({
      nome: core.adminNome ?? undefined,
      email: core.adminEmail,
      senha_temp: adminPassword,
      escolaNome: core.escolaNome || body.nome,
      loginUrl,
    });
    const sent = await sendMail({
      to: core.adminEmail,
      subject: mail.subject,
      html: String(mail.html),
      text: String(mail.text),
    });
    credentialsEmailStatus = { attempted: true, ok: sent.ok, error: sent.ok ? null : sent.error };
  }

  let inviteEmailStatus: { attempted: boolean; ok: boolean; error?: string | null } = { attempted: false, ok: false };
  if (core.adminEmail && !adminUserCreated) {
    const invite = buildInviteEmail({
      escolaNome: core.escolaNome || body.nome,
      onboardingUrl: loginUrl,
      convidadoEmail: core.adminEmail,
      convidadoNome: core.adminNome ?? undefined,
      papel: core.adminPapel,
    });
    const sent = await sendMail({
      to: core.adminEmail,
      subject: invite.subject,
      html: String(invite.html),
      text: String(invite.text),
    });
    inviteEmailStatus = { attempted: true, ok: sent.ok, error: sent.ok ? null : sent.error };
  }

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
