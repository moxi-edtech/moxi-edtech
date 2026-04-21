// apps/web/src/app/api/super-admin/users/create/route.ts
import { NextResponse } from "next/server";
import type { Database } from "~types/supabase";
import { recordAuditServer } from "@/lib/audit";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { callAuthAdminJob } from "@/lib/auth-admin-job";
import { allowedPapeisSet } from "@/lib/roles";
import { PayloadLimitError, readJsonWithLimit } from "@/lib/http/readJsonWithLimit";
import { buildCredentialsEmail, buildInviteEmail, sendMail } from "@/lib/mailer";
import { z } from "zod";
// ❌ REMOVIDO: import { generateNumeroLogin } from "@/lib/generateNumeroLogin";

// top-level não deve criar client
const SUPER_ADMIN_USERS_CREATE_MAX_JSON_BYTES = 64 * 1024; // 64KB
const CreateUserBodySchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  telefone: z.string().optional().nullable(),
  papel: z.string().min(1),
  escolaId: z.string().uuid(),
  roleEnum: z.custom<Database["public"]["Enums"]["user_role"]>((value) =>
    typeof value === "string",
  ),
  tempPassword: z.string().optional().nullable(),
});
type CreateAuthUserResult = { user?: { id: string } } | null;
type FindUserByEmailResult = { user?: { id?: string } } | null;
type UpdateUserByIdResult = { user?: { id: string } } | null;
type EscolaUserPapel = Exclude<Database["public"]["Tables"]["escola_users"]["Insert"]["papel"], null | undefined>;

export async function POST(request: Request) {
  const supabase = await supabaseServerTyped<Database>();

  try {
    const rawBody = await readJsonWithLimit(request, {
      maxBytes: SUPER_ADMIN_USERS_CREATE_MAX_JSON_BYTES,
    });
    const parsedBody = CreateUserBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { ok: false, error: parsedBody.error.issues[0]?.message ?? "Payload inválido" },
        { status: 400 },
      );
    }
    const {
      nome,
      email,
      telefone,
      papel,
      escolaId,
      roleEnum,
      tempPassword,
    } = parsedBody.data;

    // Normalize and validate papel against DB constraint
    const normalizePapel = (p: string): EscolaUserPapel => {
      const legacyMap: Record<string, string> = {
        diretor: "admin_escola",
        administrador: "admin",
        secretario: "secretaria",
      };
      const mapped = legacyMap[p] || p;
      return mapped as EscolaUserPapel;
    };

    const allowedPapeis = allowedPapeisSet;
    const papelDb = normalizePapel(String(papel || "").trim());
    if (!allowedPapeis.has(papelDb)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Papel inválido: ${papel}. Valores permitidos: ${Array.from(
            allowedPapeis,
          ).join(", ")}`,
        },
        { status: 400 },
      );
    }

    // 1) Password helpers
    const isStrongPassword = (pwd: string) => {
      return (
        typeof pwd === "string" &&
        pwd.length >= 8 &&
        /[A-Z]/.test(pwd) &&
        /[a-z]/.test(pwd) &&
        /\d/.test(pwd) &&
        /[^A-Za-z0-9]/.test(pwd)
      );
    };

    const generateStrongPassword = (len = 12) => {
      const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const lower = "abcdefghijklmnopqrstuvwxyz";
      const nums = "0123456789";
      const special = "!@#$%^&*()-_=+[]{};:,.?";
      const all = upper + lower + nums + special;
      const pick = (set: string) =>
        set[Math.floor(Math.random() * set.length)];
      let pwd =
        pick(upper) + pick(lower) + pick(nums) + pick(special);
      for (let i = pwd.length; i < len; i++) pwd += pick(all);
      // shuffle
      return pwd
        .split("")
        .sort(() => Math.random() - 0.5)
        .join("");
    };

    // 2) Validate provided temp password or generate a strong one
    let password = (tempPassword && tempPassword.trim()) || "";
    if (password) {
      if (!isStrongPassword(password)) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Senha temporária não atende aos requisitos: mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.",
          },
          { status: 400 },
        );
      }
    } else {
      password = generateStrongPassword(12);
    }

    let createdNewAuthUser = false;
    let forcedPasswordReset = false;
    let authUser = null as null | { user: { id: string } };

    // 3) Create auth user (ou reaproveita se já existir)
    {
      let data: CreateAuthUserResult = null;
      let error: unknown = null;
      try {
        data = (await callAuthAdminJob(request, "createUser", {
          email: email.trim().toLowerCase(),
          password,
          email_confirm: true,
          user_metadata: {
            nome,
            role: roleEnum,
            must_change_password: true,
          },
          app_metadata: { role: roleEnum, escola_id: escolaId },
        })) as CreateAuthUserResult;
      } catch (err) {
        error = err;
      }

      if (!data?.user) {
        const msg = error instanceof Error ? error.message.toLowerCase() : "";
        const looksLikeExisting =
          /already been registered|already registered|user exists|email exists/.test(
            msg,
          );

        if (looksLikeExisting) {
          try {
            const found = (await callAuthAdminJob(request, "findUserByEmail", {
              email: email.trim().toLowerCase(),
            })) as FindUserByEmailResult;
            const foundUserId = found?.user?.id;
            if (foundUserId) {
              authUser = { user: { id: String(foundUserId) } };
            }
          } catch (_) {
            // ignore
          }
        }

        if (!authUser) {
          return NextResponse.json(
            {
              ok: false,
              error: error instanceof Error ? error.message : "Falha ao criar usuário no Auth",
            },
            { status: 400 },
          );
        }
      } else {
        createdNewAuthUser = true;
        authUser = { user: { id: data.user.id } };
      }
    }

    if (!createdNewAuthUser && tempPassword) {
      await (callAuthAdminJob(request, "updateUserById", {
        userId: authUser!.user.id,
        attributes: { password, email_confirm: true },
      }) as Promise<UpdateUserByIdResult>);
      forcedPasswordReset = true;
    }

    // 4) Create / upsert profile
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        [
          {
            user_id: authUser!.user.id,
            email: email.trim().toLowerCase(),
            nome: nome.trim(),
            telefone: telefone || null,
            role: roleEnum,
            escola_id: escolaId,
            current_escola_id: escolaId,
          },
        ],
        { onConflict: "user_id" },
      );
    if (profileError) {
      if (createdNewAuthUser) {
        try {
          await callAuthAdminJob(request, "deleteUser", { userId: authUser!.user.id });
        } catch {
          /* ignore */
        }
      }
      return NextResponse.json(
        { ok: false, error: profileError.message },
        { status: 400 },
      );
    }

    // 5) Link to school in escola_users
    const { error: vinculoError } = await supabase
      .from("escola_users")
      .upsert(
        [
          {
            escola_id: escolaId,
            user_id: authUser!.user.id,
            papel: papelDb,
          },
        ],
        { onConflict: "escola_id,user_id" },
      );
    if (vinculoError) {
      if (createdNewAuthUser) {
        try {
          await supabase
            .from("profiles")
            .delete()
            .eq("user_id", authUser!.user.id);
          await callAuthAdminJob(request, "deleteUser", { userId: authUser!.user.id });
        } catch {
          /* ignore */
        }
      }
      return NextResponse.json(
        { ok: false, error: vinculoError.message },
        { status: 400 },
      );
    }

    // Auditoria: usuário criado pelo Super Admin
    recordAuditServer({
      escolaId,
      portal: "super_admin",
      acao: "USUARIO_CRIADO",
      entity: "usuario",
      entityId: authUser!.user.id,
      details: {
        papel,
        roleEnum,
        email: email.trim().toLowerCase(),
      },
    }).catch(() => null);

    const { data: escola } = await supabase
      .from("escolas")
      .select("nome")
      .eq("id", escolaId)
      .maybeSingle();

    const escolaNome = String((escola as { nome?: string | null } | null)?.nome ?? "sua escola");
    const loginUrl = (process.env.KLASSE_AUTH_URL?.trim() || `${new URL(request.url).origin}/login`).replace(/\/$/, "");

    let emailStatus: {
      attempted: boolean;
      ok: boolean;
      kind?: "credentials" | "invite";
      error?: string | null;
    } = { attempted: false, ok: false };

    if (createdNewAuthUser || forcedPasswordReset) {
      const mail = buildCredentialsEmail({
        nome,
        email: email.trim().toLowerCase(),
        senha_temp: password,
        escolaNome,
        loginUrl,
      });
      const sent = await sendMail({
        to: email.trim().toLowerCase(),
        subject: mail.subject,
        html: String(mail.html),
        text: String(mail.text),
      });
      emailStatus = {
        attempted: true,
        ok: sent.ok,
        kind: "credentials",
        error: sent.ok ? null : sent.error,
      };
    } else {
      const invite = buildInviteEmail({
        escolaNome,
        onboardingUrl: loginUrl,
        convidadoEmail: email.trim().toLowerCase(),
        convidadoNome: nome,
        papel: papelDb,
      });
      const sent = await sendMail({
        to: email.trim().toLowerCase(),
        subject: invite.subject,
        html: String(invite.html),
        text: String(invite.text),
      });
      emailStatus = {
        attempted: true,
        ok: sent.ok,
        kind: "invite",
        error: sent.ok ? null : sent.error,
      };
    }

    return NextResponse.json({
      ok: true,
      userId: authUser!.user.id,
      tempPassword: createdNewAuthUser || forcedPasswordReset ? password : null,
      emailStatus,
    });
  } catch (err) {
    if (err instanceof PayloadLimitError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.status },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
