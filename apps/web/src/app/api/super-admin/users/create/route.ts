// apps/web/src/app/api/super-admin/users/create/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { recordAuditServer } from "@/lib/audit";
import { getSupabaseServerClient } from "@/lib/supabase-server";
// ❌ REMOVIDO: import { generateNumeroLogin } from "@/lib/generateNumeroLogin";

// top-level não deve criar client

export async function POST(request: Request) {
  const admin = getSupabaseServerClient();
  if (!admin) {
    return new Response(
      "Supabase not configured (SUPABASE_URL or key missing)",
      { status: 503 },
    );
  }
  const supabase = admin;

  try {
    const body = await request.json();
    const {
      nome,
      email,
      telefone,
      papel,
      escolaId,
      roleEnum,
      tempPassword,
    }: {
      nome: string;
      email: string;
      telefone?: string | null;
      papel: string;
      escolaId: string;
      roleEnum: Database["public"]["Enums"]["user_role"];
      tempPassword?: string | null;
    } = body;

    // Normalize and validate papel against DB constraint
    const normalizePapel = (
      p: string,
    ): Database["public"]["Tables"]["escola_users"]["Row"] extends {
      papel: infer T;
    }
      ? T extends string
        ? T
        : string
      : string => {
      const legacyMap: Record<string, string> = {
        diretor: "admin_escola",
        administrador: "admin",
        secretario: "secretaria",
      };
      const mapped = legacyMap[p] || p;
      return mapped as any;
    };

    const allowedPapeis = new Set([
      "admin",
      "staff_admin",
      "financeiro",
      "secretaria",
      "aluno",
      "professor",
      "admin_escola",
    ]);
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
    let authUser = null as null | { user: { id: string } };

    // 3) Create auth user (ou reaproveita se já existir)
    {
      const { data, error } = await admin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: {
          nome,
          role: roleEnum,
          must_change_password: true,
        },
        // app_metadata carrega role e escola no JWT
        app_metadata: { role: roleEnum, escola_id: escolaId } as any,
      });

      if (error || !data?.user) {
        const msg = error?.message?.toLowerCase() || "";
        const looksLikeExisting =
          /already been registered|already registered|user exists|email exists/.test(
            msg,
          );

        if (looksLikeExisting) {
          try {
            const { data: users } =
              await admin.auth.admin.listUsers({
                page: 1,
                perPage: 1000,
              });
            const found = users?.users?.find(
              (u: any) =>
                String(u.email).toLowerCase() ===
                email.trim().toLowerCase(),
            );
            if (found) {
              authUser = { user: { id: String(found.id) } };
            }
          } catch (_) {
            // ignore, will fall through and report original error
          }
        }

        if (!authUser) {
          return NextResponse.json(
            {
              ok: false,
              error: error?.message || "Falha ao criar usuário no Auth",
            },
            { status: 400 },
          );
        }
      } else {
        createdNewAuthUser = true;
        authUser = { user: { id: data.user.id } };
      }
    }

    // 4) Create / upsert profile (sem numero_login aqui)
    const { error: profileError } = await admin
      .from("profiles" as any)
      .upsert(
        [
          {
            user_id: authUser!.user.id,
            email: email.trim().toLowerCase(),
            nome: nome.trim(),
            telefone: telefone || null,
            role: roleEnum,
            escola_id: escolaId,
            // numero_login: null // se for aluno, será preenchido pela matricula
          },
        ] as any,
        { onConflict: "user_id" },
      );
    if (profileError) {
      if (createdNewAuthUser) {
        try {
          await admin.auth.admin.deleteUser(authUser!.user.id);
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
    const { error: vinculoError } = await admin
      .from("escola_users" as any)
      .upsert(
        [
          {
            escola_id: escolaId,
            user_id: authUser!.user.id,
            papel: papelDb,
          },
        ] as any,
        { onConflict: "escola_id,user_id" },
      );
    if (vinculoError) {
      if (createdNewAuthUser) {
        try {
          await admin
            .from("profiles" as any)
            .delete()
            .eq("user_id", authUser!.user.id);
          await admin.auth.admin.deleteUser(authUser!.user.id);
        } catch {
          /* ignore */
        }
      }
      return NextResponse.json(
        { ok: false, error: vinculoError.message },
        { status: 400 },
      );
    }

    // ❌ 6) NÃO geramos numero_login aqui.
    // numero_login agora é exclusivo do fluxo de matrícula (create_or_confirm_matricula + next_matricula_number).
    const numeroLogin: string | null = null;

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

    return NextResponse.json({
      ok: true,
      userId: authUser!.user.id,
      tempPassword: createdNewAuthUser ? password : null,
      numeroLogin, // sempre null aqui; se for aluno, ele ganha via matrícula
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
