// apps/web/src/app/api/escolas/create/route.ts
import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "~types/supabase";
import { z } from "zod";
import { recordAuditServer } from "@/lib/audit";
import { buildOnboardingEmail, sendMail } from "@/lib/mailer";
import type { DBWithRPC } from "@/types/supabase-augment";
import { generateNumeroLogin } from "@/lib/generateNumeroLogin"; // ✅ import helper

const BodySchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da escola."),
  nif: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\D/g, "") : undefined))
    .refine((v) => (v ? /^\d{9}$/.test(v) : true), {
      message: "NIF inválido. Use 9 dígitos.",
    })
    .nullable()
    .optional(),
  endereco: z.string().trim().nullable().optional(),
  admin: z.object({
    email: z
      .string()
      .email("Email do administrador inválido.")
      .transform((v) => v.toLowerCase()),
    telefone: z
      .string()
      .transform((v) => v.replace(/\D/g, ""))
      .refine((v) => (v ? /^9\d{8}$/.test(v) : true), {
        message: "Telefone inválido. Use o formato 9XXXXXXXX.",
      })
      .nullable()
      .optional(),
    nome: z.string().trim().nullable().optional(),
    password: z.string().trim().min(1).nullable().optional(),
  }),
  plano: z.enum(["basico", "standard", "premium"]).default("basico").optional(),
  aluno_portal_enabled: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<DBWithRPC>();
    const {
      data: { session },
    } = await (supabase as any).auth.getSession();
    const user = session?.user;
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 }
      );
    }
    const { data: prof } = await (supabase as any)
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const role = (prof?.[0] as any)?.role || null;
    if (role !== "super_admin") {
      return NextResponse.json(
        { ok: false, error: "Sem permissão" },
        { status: 403 }
      );
    }

    const parse = BodySchema.safeParse(await req.json());
    if (!parse.success) {
      const msg = parse.error.errors[0]?.message || "Dados inválidos";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const body = parse.data;
    const nome = body.nome;
    const nif = body.nif ?? null;
    const endereco = body.endereco ?? null;
    const adminEmail = body.admin?.email ?? null;
    const adminTelefone = body.admin?.telefone ?? null;
    const adminNome = body.admin?.nome ?? null;
    const adminPassword = body.admin?.password?.trim() || null;
    const plano = (body.plano || "basico") as "basico" | "standard" | "premium";
    const allowAlunoPortal = plano === "standard" || plano === "premium";
    const alunoPortalEnabled = allowAlunoPortal
      ? Boolean(body.aluno_portal_enabled)
      : false;

    const { data, error } = await (supabase as any).rpc(
      "create_escola_with_admin",
      {
        p_nome: nome,
        p_nif: nif,
        p_endereco: endereco,
        p_admin_email: adminEmail,
        p_admin_telefone: adminTelefone,
        p_admin_nome: adminNome,
      }
    );

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const result = data as {
      ok?: boolean;
      escolaId?: string;
      escolaNome?: string;
      mensagemAdmin?: string;
    };

    if (result?.escolaId) {
      const sAny = supabase as any;
      await sAny
        .from("escolas")
        .update({ plano, aluno_portal_enabled: alunoPortalEnabled })
        .eq("id", result.escolaId);
    }

    let mensagemAdminAugment: string | null = null;
    let actionLinkForUi: string | null = null;
    let emailStatus: {
      attempted: boolean;
      via: "custom" | "supabase-invite" | "supabase-magic" | null;
      ok: boolean;
      error?: string;
    } | null = null;

    if (adminEmail && result?.escolaId) {
      if (
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.SUPABASE_SERVICE_ROLE_KEY
      ) {
        return NextResponse.json({
          ...result,
          mensagemAdmin:
            (result?.mensagemAdmin || "") +
            " ⚠️ Vinculação/criação do administrador não realizada: falta SUPABASE_SERVICE_ROLE_KEY.",
        });
      }

      const admin = createAdminClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const lower = adminEmail.toLowerCase();

      // ✅ Gerar numero_login para admin
      const numeroLogin = await generateNumeroLogin(result.escolaId!, "admin");

      // Buscar user existente por email
      const { data: prof } = await admin
        .from("profiles")
        .select("user_id, email, role, numero_login")
        .eq("email", lower)
        .limit(1);
      let userId = prof?.[0]?.user_id as string | undefined;

      // Se já existe, atualiza metadata e profile
      if (userId) {
        await admin
          .from("profiles")
          .update({
            role: "admin" as any,
            nome: adminNome ?? undefined,
            telefone: adminTelefone ?? undefined,
            numero_login: prof?.[0]?.numero_login || numeroLogin,
          })
          .eq("user_id", userId);
      } else {
        // Criar novo usuário no auth
        const { data: created, error: crtErr } =
          await admin.auth.admin.createUser({
            email: lower,
            password:
              adminPassword && adminPassword.length > 0
                ? adminPassword
                : undefined,
            email_confirm: true,
            user_metadata: {
              role: "admin",
              escola_id: result.escolaId!,
              numero_login: numeroLogin,
              nome: adminNome ?? undefined,
            },
          });
        if (crtErr || !created?.user)
          return NextResponse.json(
            { ok: false, error: crtErr?.message || "Falha ao criar usuário admin" },
            { status: 400 }
          );
        userId = created.user.id;

        await admin.from("profiles").insert([
          {
            user_id: userId,
            email: lower,
            nome: adminNome ?? null,
            telefone: adminTelefone ?? null,
            role: "admin" as any,
            numero_login: numeroLogin,
            escola_id: result.escolaId!,
          } as TablesInsert<"profiles">,
        ]);
      }

      // 🔗 Vincular admin à escola
      if (userId) {
        await admin.from("escola_usuarios").upsert(
          [
            {
              escola_id: result.escolaId!,
              user_id: userId,
              papel: "admin",
            } as TablesInsert<"escola_usuarios">,
          ],
          { onConflict: "escola_id,user_id" }
        );
      }

      mensagemAdminAugment =
        (result?.mensagemAdmin || "") +
        ` 🔢 Número de login do administrador: ${numeroLogin}`;
    }

    if (result?.escolaId) {
      recordAuditServer({
        escolaId: result.escolaId,
        portal: "super_admin",
        action: "ESCOLA_CRIADA",
        entity: "escola",
        entityId: result.escolaId,
        details: { nome: result.escolaNome, plano, aluno_portal_enabled: alunoPortalEnabled },
      }).catch(() => null);
    }

    if (mensagemAdminAugment != null) {
      return NextResponse.json({
        ...result,
        mensagemAdmin: mensagemAdminAugment,
        actionLink: actionLinkForUi,
        emailStatus,
      });
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
