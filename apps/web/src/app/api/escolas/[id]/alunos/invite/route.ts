// apps/web/src/app/api/escolas/[id]/alunos/invite/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "~types/supabase";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { recordAuditServer } from "@/lib/audit";
// ❌ REMOVIDO: import { generateNumeroLogin } from "@/lib/generateNumeroLogin";
import { buildCredentialsEmail, sendMail } from "@/lib/mailer";
import { sanitizeEmail } from "@/lib/sanitize";

const BodySchema = z.object({
  email: z.string().email(),
  nome: z.string().trim().min(1),
  alunoId: z.string().uuid().optional().nullable(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: escolaId } = await context.params;

  try {
    const parse = BodySchema.safeParse(await req.json());
    if (!parse.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parse.error.issues[0]?.message || "Dados inválidos",
        },
        { status: 400 },
      );
    }

    const { email: rawEmail, nome, alunoId } = parse.data;
    const email = sanitizeEmail(rawEmail);

    const s = await supabaseServer();
    const { data: userRes } = await s.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 },
      );
    }

    const { data: vinc } = await s
      .from("escola_users")
      .select("papel")
      .eq("user_id", user.id)
      .eq("escola_id", escolaId)
      .limit(1);

    const papel = (vinc?.[0] as any)?.papel || null;
    if (!hasPermission(papel as any, "criar_matricula")) {
      return NextResponse.json(
        { ok: false, error: "Sem permissão" },
        { status: 403 },
      );
    }

    // Hard check: profile do usuário logado deve pertencer à escola
    const { data: profCheck } = await s
      .from("profiles" as any)
      .select("escola_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profCheck || (profCheck as any).escola_id !== escolaId) {
      return NextResponse.json(
        { ok: false, error: "Perfil não vinculado à escola" },
        { status: 403 },
      );
    }

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta SUPABASE_SERVICE_ROLE_KEY para convidar.",
        },
        { status: 500 },
      );
    }

    const admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    // 1) Tentar reaproveitar numero_login existente (se o aluno já tiver matrícula)
    let numeroLogin: string | null = null;
    try {
      const { data: existing } = await admin
        .from("profiles" as any)
        .select("numero_login")
        .eq("email", email)
        .eq("escola_id", escolaId)
        .limit(1);

      numeroLogin = (existing?.[0] as any)?.numero_login ?? null;
    } catch {
      // best-effort
    }

    // ❌ NÃO GERAMOS mais numero_login aqui.
    // Ele passa a ser responsabilidade da função create_or_confirm_matricula
    // (via next_matricula_number) quando a matrícula for criada/confirmada.

    // 2) Verificar se já existe usuário para esse email
    const { data: prof } = await admin
      .from("profiles")
      .select("user_id")
      .eq("email", email)
      .limit(1);

    let userId = (prof?.[0] as any)?.user_id as string | undefined;
    let invited = false;

    if (!userId) {
      // Convida novo usuário
      const { data: inv, error: invErr } = await (admin as any).auth.admin
        .inviteUserByEmail(email, {
          data: {
            nome,
            role: "aluno",
            // numero_usuario: numeroLogin || undefined, // só se já existir
            must_change_password: true,
          },
        });

      if (invErr) {
        return NextResponse.json(
          { ok: false, error: invErr.message },
          { status: 400 },
        );
      }

      userId = inv?.user?.id;
      invited = true;

      if (!userId) {
        return NextResponse.json(
          { ok: false, error: "Falha ao convidar" },
          { status: 400 },
        );
      }

      // Cria profile para o convidado
      try {
        await admin.from("profiles").insert([
          {
            user_id: userId,
            email,
            nome,
            numero_login: numeroLogin ?? null, // se já havia matrícula anterior, reaproveita; senão fica null
            role: "aluno" as any,
            escola_id: escolaId,
          } as TablesInsert<"profiles">,
        ]);
      } catch {
        // best-effort
      }

      // Atualiza app_metadata com role/escola (e numero_usuario só se já existir)
      try {
        await (admin as any).auth.admin.updateUserById(userId, {
          app_metadata: {
            role: "aluno",
            escola_id: escolaId,
            numero_usuario: numeroLogin || undefined,
          },
        });
      } catch {
        // best-effort
      }
    } else {
      // Usuário já existe: garante role/escola e mantém (ou reaproveita) numero_login
      try {
        await admin
          .from("profiles")
          .update({
            role: "aluno" as any,
            escola_id: escolaId,
            // numero_login: numeroLogin ?? undefined, // só atualizamos se já houver
          })
          .eq("user_id", userId);
      } catch {
        // best-effort
      }

      try {
        await (admin as any).auth.admin.updateUserById(userId, {
          app_metadata: {
            role: "aluno",
            escola_id: escolaId,
            numero_usuario: numeroLogin || undefined,
          },
        });
      } catch {
        // best-effort
      }
    }

    // 3) Vincula à tabela escola_users
    try {
      await admin
        .from("escola_users")
        .upsert(
          {
            escola_id: escolaId,
            user_id: userId!,
            papel: "aluno",
          } as TablesInsert<"escola_users">,
          { onConflict: "escola_id,user_id" },
        );
    } catch {
      // best-effort
    }

    // 4) Tenta vincular ao aluno (registro em alunos)
    if (alunoId) {
      try {
        await admin
          .from("alunos")
          .update({ profile_id: userId! } as any)
          .eq("id", alunoId);
      } catch {
        // best-effort
      }
    } else {
      try {
        await admin
          .from("alunos")
          .update({ profile_id: userId! } as any)
          .eq("escola_id", escolaId)
          .eq("email", email);
      } catch {
        // best-effort
      }
    }

    // 5) Auditoria
    recordAuditServer({
      escolaId,
      portal: "secretaria",
      acao: "ALUNO_CONVIDADO",
      entity: "aluno",
      entityId: alunoId ?? userId!,
      details: { email, invited, numero_login: numeroLogin },
    }).catch(() => null);

    // 6) E-mail com credenciais
    // Mantemos a lógica: só envia email "com credenciais" se já houver numero_login.
    // Caso contrário, o fluxo será:
    // - ele recebe o email padrão do Supabase (invite)
    // - e depois, quando matriculado, pode receber outro email com as credenciais completas.
    try {
      if (numeroLogin) {
        const { data: esc } = await admin
          .from("escolas" as any)
          .select("nome")
          .eq("id", escolaId)
          .maybeSingle();
        const escolaNome = (esc as any)?.nome ?? null;
        const loginUrl = process.env.NEXT_PUBLIC_BASE_URL
          ? `${process.env.NEXT_PUBLIC_BASE_URL}/login`
          : null;
        const mail = buildCredentialsEmail({
          nome,
          email,
          numero_login: numeroLogin,
          escolaNome,
          loginUrl,
        });
        await sendMail({
          to: email,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        });
      }
    } catch {
      // best-effort
    }

    return NextResponse.json({ ok: true, userId, numero: numeroLogin });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
