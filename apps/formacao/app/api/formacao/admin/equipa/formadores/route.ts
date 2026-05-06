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
  telefone: string | null;
  nif: string | null;
  bi_numero: string | null;
  sexo: string | null;
  grau_academico: string | null;
  especialidades: string[] | null;
  bio: string | null;
  banco: string | null;
  iban: string | null;
  access?: FormadorAccessStatus;
};

type RpcClient = {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

type FormadorAccessStatus = {
  status: "active" | "created" | "needs_password" | "pending_confirmation" | "blocked" | "unknown";
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  must_change_password: boolean;
  banned_until: string | null;
  error: string | null;
};

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

async function getFormadoresFromMemberships(client: FormacaoSupabaseClient, escolaId: string) {
  const { data, error } = await (client as unknown as RpcClient).rpc("formacao_formadores_por_centro", {
    p_escola_id: escolaId,
  });

  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return [] as ProfileRow[];

  return data
    .map((row) => {
      const parsed = row as any;
      if (!parsed.user_id || !parsed.nome) return null;
      return {
        user_id: String(parsed.user_id),
        nome: String(parsed.nome),
        email: parsed.email ? String(parsed.email) : null,
        telefone: parsed.telefone ? String(parsed.telefone) : null,
        nif: parsed.nif ? String(parsed.nif) : null,
        bi_numero: parsed.bi_numero ? String(parsed.bi_numero) : null,
        sexo: parsed.sexo ? String(parsed.sexo) : null,
        grau_academico: parsed.grau_academico ? String(parsed.grau_academico) : null,
        especialidades: Array.isArray(parsed.especialidades) ? parsed.especialidades : null,
        bio: parsed.bio ? String(parsed.bio) : null,
        banco: parsed.banco ? String(parsed.banco) : null,
        iban: parsed.iban ? String(parsed.iban) : null,
      };
    })
    .filter((row): row is ProfileRow => Boolean(row));
}

async function getFormadorAccessStatus(request: Request, userId: string): Promise<FormadorAccessStatus> {
  try {
    const raw = (await callAuthAdminJob(request, "getUserById", { userId })) as any;
    const user = raw?.user;
    if (!user) {
      return {
        status: "unknown",
        email_confirmed_at: null,
        last_sign_in_at: null,
        must_change_password: false,
        banned_until: null,
        error: "Utilizador Auth não encontrado",
      };
    }

    const bannedUntil = typeof user.banned_until === "string" ? user.banned_until : null;
    const isBlocked = bannedUntil ? Date.parse(bannedUntil) > Date.now() : false;
    const emailConfirmedAt = typeof user.email_confirmed_at === "string" ? user.email_confirmed_at : null;
    const lastSignInAt = typeof user.last_sign_in_at === "string" ? user.last_sign_in_at : null;
    const mustChangePassword = Boolean(user.user_metadata?.must_change_password);

    let status: FormadorAccessStatus["status"] = "created";
    if (isBlocked) status = "blocked";
    else if (!emailConfirmedAt) status = "pending_confirmation";
    else if (mustChangePassword) status = "needs_password";
    else if (lastSignInAt) status = "active";

    return {
      status,
      email_confirmed_at: emailConfirmedAt,
      last_sign_in_at: lastSignInAt,
      must_change_password: mustChangePassword,
      banned_until: bannedUntil,
      error: null,
    };
  } catch (error) {
    return {
      status: "unknown",
      email_confirmed_at: null,
      last_sign_in_at: null,
      must_change_password: false,
      banned_until: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  try {
    const s = auth.supabase as FormacaoSupabaseClient;
    const items = await getFormadoresFromMemberships(s, auth.escolaId);
    const itemsWithAccess = await Promise.all(
      items.map(async (item) => ({
        ...item,
        access: await getFormadorAccessStatus(request, item.user_id),
      }))
    );

    return NextResponse.json({
      ok: true,
      items: itemsWithAccess.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
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

  const body = (await request.json().catch(() => null)) as any;

  const nome = String(body?.nome ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();

  if (!nome || !email) {
    return NextResponse.json({ ok: false, error: "nome e email são obrigatórios" }, { status: 400 });
  }

  try {
    const s = auth.supabase as FormacaoSupabaseClient;
    const { data: escola } = await s.from("escolas").select("nome").eq("id", auth.escolaId).maybeSingle();
    const escolaNome = String((escola as any)?.nome ?? "Centro de Formação").trim();

    const existingData = (await callAuthAdminJob(request, "findUserByEmail", { email })) as any;
    const existing = existingData?.user as any;
    const tempPassword = generateTemporaryPassword();

    let userId = existing?.id ?? null;
    let createdNew = false;

    const profileData = {
      nome,
      email,
      telefone: body.telefone || null,
      bi_numero: body.bi_numero || null,
      nif: body.nif || null,
      sexo: body.sexo || null,
      grau_academico: body.grau_academico || null,
      especialidades: body.especialidades || null,
      bio: body.bio || null,
      banco: body.banco || null,
      iban: body.iban || null,
      role: "formador" as any,
      escola_id: auth.escolaId,
      current_escola_id: auth.escolaId,
    };

    if (!userId) {
      const createdData = (await callAuthAdminJob(request, "createUser", {
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          ...profileData,
          tenant_type: "formacao",
          must_change_password: true,
        },
        app_metadata: {
          role: "formador",
          escola_id: auth.escolaId,
          tenant_type: "formacao",
        },
      })) as any;

      userId = createdData?.user?.id ?? null;
      if (!userId) throw new Error("Falha ao criar utilizador");
      createdNew = true;
    } else {
      await callAuthAdminJob(request, "updateUserById", {
        userId,
        attributes: {
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            ...(existing?.user_metadata ?? {}),
            ...profileData,
            tenant_type: "formacao",
            must_change_password: true,
          },
          app_metadata: {
            ...(existing?.app_metadata ?? {}),
            role: "formador",
            escola_id: auth.escolaId,
            tenant_type: "formacao",
          },
        },
      });
    }

    await callAuthAdminJob(request, "upsertProfile", {
      profile: { ...profileData, user_id: userId },
      onConflict: "user_id",
    });

    await callAuthAdminJob(request, "upsertEscolaUser", {
      escolaUser: {
        escola_id: auth.escolaId,
        user_id: userId,
        papel: "formador",
        tenant_type: "formacao",
      },
    });

    const mailContent = buildFormadorAccessEmail({
      nome,
      email,
      escolaNome,
      senha_temp: tempPassword,
      recoveryUrl: null,
      loginUrl: resolveFormacaoLoginUrl(request),
      existingUser: !createdNew,
    });
    const mailResult = await sendMail({ to: email, ...mailContent });

    return NextResponse.json({
      ok: true,
      item: { user_id: userId, nome, email },
      created_new: createdNew,
      temporary_password: !mailResult.ok ? tempPassword : null,
      email_sent: mailResult.ok,
      email_error: mailResult.ok ? null : mailResult.error,
      manual_access_url: null,
      recovery_link_generated: false,
      recovery_link_error: null,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao cadastrar formador" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as any;
  const userId = body?.user_id;

  if (!userId) {
    return NextResponse.json({ ok: false, error: "user_id é obrigatório" }, { status: 400 });
  }

  try {
    const s = auth.supabase as FormacaoSupabaseClient;
    const formadores = await getFormadoresFromMemberships(s, auth.escolaId);
    const formador = formadores.find((item) => item.user_id === userId);

    if (!formador) {
      return NextResponse.json({ ok: false, error: "Utilizador não pertence a este centro" }, { status: 403 });
    }

    if (body?.reset_password) {
      if (!formador.email) throw new Error("Utilizador sem email configurado");

      const { data: escola } = await s.from("escolas").select("nome").eq("id", auth.escolaId).maybeSingle();
      const escolaNome = String((escola as any)?.nome ?? "Centro de Formação").trim();
      const tempPassword = generateTemporaryPassword();

      const rawUser = (await callAuthAdminJob(request, "getUserById", { userId })) as any;
      const currentMetadata = rawUser?.user?.user_metadata ?? {};

      await callAuthAdminJob(request, "updateUserById", {
        userId,
        attributes: {
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            ...currentMetadata,
            must_change_password: true,
          },
        },
      });

      const mailContent = buildFormadorAccessEmail({
        nome: formador.nome || "Formador",
        email: formador.email,
        escolaNome,
        senha_temp: tempPassword,
        recoveryUrl: null,
        loginUrl: resolveFormacaoLoginUrl(request),
        existingUser: true,
      });

      const mailResult = await sendMail({ to: formador.email, ...mailContent });
      return NextResponse.json({
        ok: true,
        temporary_password: mailResult.ok ? null : tempPassword,
        email_sent: mailResult.ok,
        email_error: mailResult.ok ? null : mailResult.error,
        manual_access_url: null,
        recovery_link_generated: false,
      });
    }

    const updateFields = { ...body };
    delete updateFields.user_id;
    delete updateFields.reset_password;

    if (Object.keys(updateFields).length > 0) {
      await callAuthAdminJob(request, "updateUserById", {
        userId,
        attributes: {
          user_metadata: { ...updateFields },
        },
      });

      await callAuthAdminJob(request, "upsertProfile", {
        profile: { ...updateFields, user_id: userId },
        onConflict: "user_id",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao atualizar formador" },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId é obrigatório" }, { status: 400 });
  }

  try {
    const s = auth.supabase as FormacaoSupabaseClient;

    const { error } = await s
      .from("escola_users")
      .delete()
      .eq("escola_id", auth.escolaId)
      .eq("user_id", userId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao remover vínculo" },
      { status: 400 }
    );
  }
}
