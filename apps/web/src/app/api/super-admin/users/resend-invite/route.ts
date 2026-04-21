import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";
import { callAuthAdminJob } from "@/lib/auth-admin-job";
import { buildInviteEmail, sendMail } from "@/lib/mailer";
import { recordAuditServer } from "@/lib/audit";
import { PayloadLimitError, readJsonWithLimit } from "@/lib/http/readJsonWithLimit";

const SUPER_ADMIN_USERS_RESEND_INVITE_MAX_JSON_BYTES = 64 * 1024; // 64KB

const BodySchema = z.object({
  userId: z.string().uuid(),
});

type GenerateLinkResult = {
  properties?: { action_link?: string | null };
  action_link?: string | null;
} | null;

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
    const { userId } = parsed.data;

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

    if (escolaId) {
      const [{ data: escolaRow }, { data: membershipRow }] = await Promise.all([
        s.from("escolas").select("nome").eq("id", escolaId).maybeSingle(),
        s
          .from("escola_users")
          .select("papel")
          .eq("escola_id", escolaId)
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
      escolaNome = String((escolaRow as { nome?: string | null } | null)?.nome ?? escolaNome);
      papel = ((membershipRow as { papel?: string | null } | null)?.papel ?? null) as string | null;
    }

    const base = new URL(request.url).origin;
    const loginUrl = (process.env.KLASSE_AUTH_URL?.trim() || `${base}/login`).replace(/\/$/, "");
    const redirectTo = `${base}/redirect`;
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

    let sent = await sendMail({
      to: email,
      subject: invite.subject,
      html: String(invite.html),
      text: String(invite.text),
    });

    let via: "resend" | "supabase" = "resend";
    if (!sent.ok) {
      const resendError = sent.error;
      try {
        await callAuthAdminJob(request, "inviteUserByEmail", {
          email,
          options: { redirectTo },
        });
        sent = { ok: true };
        via = "supabase";
      } catch (fallbackError) {
        sent = {
          ok: false,
          error:
            fallbackError instanceof Error
              ? `${resendError} | fallback supabase: ${fallbackError.message}`
              : `${resendError} | fallback supabase: ${String(fallbackError)}`,
        };
      }
    }

    recordAuditServer({
      escolaId,
      portal: "super_admin",
      acao: "USUARIO_REENVIAR_CONVITE",
      entity: "usuario",
      entityId: userId,
      details: {
        email,
        escolaId,
        sent_ok: sent.ok,
        via,
      },
    }).catch(() => null);

    return NextResponse.json({
      ok: sent.ok,
      emailStatus: {
        attempted: true,
        ok: sent.ok,
        kind: "invite",
        error: sent.ok ? null : sent.error,
        via,
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
