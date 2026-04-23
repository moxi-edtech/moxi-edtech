import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";
import { callAuthAdminJob } from "@/lib/auth-admin-job";
import { buildCredentialsEmail, buildInviteEmail, sendMail } from "@/lib/mailer";
import { recordAuditServer } from "@/lib/audit";
import { PayloadLimitError, readJsonWithLimit } from "@/lib/http/readJsonWithLimit";

const SUPER_ADMIN_USERS_RESEND_INVITE_MAX_JSON_BYTES = 64 * 1024; // 64KB

const BodySchema = z.object({
  userId: z.string().uuid(),
  mode: z.enum(["credentials", "invite"]).optional(),
});

type GenerateLinkResult = {
  properties?: { action_link?: string | null };
  action_link?: string | null;
} | null;

function generateStrongPassword(length = 12): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()-_=+[]{};:,.?";
  const all = upper + lower + numbers + symbols;
  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];

  let password = pick(upper) + pick(lower) + pick(numbers) + pick(symbols);
  while (password.length < length) password += pick(all);

  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

export async function POST(request: Request) {
  try {
    const bodyRaw = await readJsonWithLimit(request, {
      maxBytes: SUPER_ADMIN_USERS_RESEND_INVITE_MAX_JSON_BYTES,
    });
    const parsed = BodySchema.safeParse(bodyRaw);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Payload inválido" },
        { status: 400 }
      );
    }
    const { userId, mode = "credentials" } = parsed.data;

    const s = await supabaseServer();
    const { data: authData } = await s.auth.getUser();
    const currentUser = authData?.user;
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { data: currentProfileRows } = await s
      .from("profiles")
      .select("role")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const currentRole = currentProfileRows?.[0]?.role as string | undefined;
    if (!isSuperAdminRole(currentRole)) {
      return NextResponse.json({ ok: false, error: "Somente Super Admin" }, { status: 403 });
    }

    const { data: profile } = await s
      .from("profiles")
      .select("user_id, nome, email, email_real, escola_id, current_escola_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) {
      return NextResponse.json({ ok: false, error: "Usuário não encontrado" }, { status: 404 });
    }

    const email = String(profile.email_real || profile.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ ok: false, error: "Email do usuário não encontrado" }, { status: 404 });
    }

    const escolaId = String(profile.current_escola_id || profile.escola_id || "").trim() || null;
    let escolaNome = "sua escola";
    let papel: string | null = null;
    let numeroProcessoLogin: string | null = null;

    if (escolaId) {
      const [{ data: escolaRow }, { data: membershipRow }, { data: alunoRow }] = await Promise.all([
        s.from("escolas").select("nome").eq("id", escolaId).maybeSingle(),
        s
          .from("escola_users")
          .select("papel")
          .eq("escola_id", escolaId)
          .eq("user_id", userId)
          .maybeSingle(),
        s
          .from("alunos")
          .select("numero_processo_login")
          .eq("escola_id", escolaId)
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
      escolaNome = String((escolaRow as { nome?: string | null } | null)?.nome ?? escolaNome);
      papel = ((membershipRow as { papel?: string | null } | null)?.papel ?? null) as string | null;
      numeroProcessoLogin = ((alunoRow as { numero_processo_login?: string | null } | null)?.numero_processo_login ?? null) as string | null;
    }

    const base = new URL(request.url).origin;
    const loginUrl = (process.env.KLASSE_AUTH_URL?.trim() || `${base}/login`).replace(/\/$/, "");
    const redirectTo = `${base}/redirect`;
    let sent = { ok: false as boolean, error: null as string | null };
    let tempPassword: string | null = null;

    if (mode === "invite") {
      let actionLink: string | null = null;
      try {
        const linkData = (await callAuthAdminJob(request, "generateLink", {
          type: "invite",
          email,
          options: { redirectTo },
        })) as GenerateLinkResult;
        actionLink = linkData?.properties?.action_link || linkData?.action_link || null;
      } catch {
        actionLink = null;
      }

      const invite = buildInviteEmail({
        escolaNome,
        onboardingUrl: actionLink || loginUrl,
        convidadoEmail: email,
        convidadoNome: profile.nome || undefined,
        papel,
      });
      const inviteSent = await sendMail({
        to: email,
        subject: invite.subject,
        html: String(invite.html),
        text: String(invite.text),
      });
      sent = { ok: inviteSent.ok, error: inviteSent.ok ? null : inviteSent.error || null };

      if (!sent.ok) {
        try {
          await callAuthAdminJob(request, "inviteUserByEmail", {
            email,
            options: { redirectTo },
          });
          sent = { ok: true, error: null };
        } catch (fallbackError) {
          sent = {
            ok: false,
            error:
              fallbackError instanceof Error
                ? `${sent.error || "Falha no envio"} | fallback supabase: ${fallbackError.message}`
                : `${sent.error || "Falha no envio"} | fallback supabase: ${String(fallbackError)}`,
          };
        }
      }
    } else {
      tempPassword = generateStrongPassword(12);
      const authUserRaw = await callAuthAdminJob(request, "getUserById", { userId }) as
        | { user?: { user_metadata?: Record<string, unknown> | null } | null }
        | null;
      const currentMetadata = authUserRaw?.user?.user_metadata ?? {};

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

      const credentials = buildCredentialsEmail({
        nome: profile.nome || undefined,
        email,
        numero_processo_login: numeroProcessoLogin,
        senha_temp: tempPassword,
        escolaNome,
        loginUrl,
      });

      const credentialsSent = await sendMail({
        to: email,
        subject: credentials.subject,
        html: String(credentials.html),
        text: String(credentials.text),
      });
      sent = { ok: credentialsSent.ok, error: credentialsSent.ok ? null : credentialsSent.error || null };
    }

    recordAuditServer({
      escolaId,
      portal: "super_admin",
      acao: mode === "invite" ? "USUARIO_REENVIAR_CONVITE" : "USUARIO_REENVIAR_CREDENCIAIS",
      entity: "usuario",
      entityId: userId,
      details: {
        email,
        escolaId,
        sent_ok: sent.ok,
        via: "resend",
        papel,
        mode,
      },
    }).catch(() => null);

    return NextResponse.json({
      ok: sent.ok,
      tempPassword: sent.ok ? tempPassword : null,
      emailStatus: {
        attempted: true,
        ok: sent.ok,
        kind: mode,
        error: sent.ok ? null : sent.error,
        via: "resend",
      },
    });
  } catch (error) {
    if (error instanceof PayloadLimitError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao reenviar convite" },
      { status: 500 }
    );
  }
}
