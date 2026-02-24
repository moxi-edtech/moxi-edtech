import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "~types/supabase";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type AdminAction =
  | "createUser"
  | "inviteUserByEmail"
  | "updateUserById"
  | "deleteUser"
  | "getUserById"
  | "listUsers"
  | "generateLink"
  | "findUserByEmail"
  | "resolveIdentifierToEmail"
  | "activateStudentAccess"
  | "seedSuperAdmin"
  | "seedTest";

type AdminRequest = {
  action: AdminAction;
  payload: Record<string, any>;
};

function resolveJobToken(req: Request) {
  return req.headers.get("x-job-token") || req.headers.get("authorization")?.replace("Bearer ", "");
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key);
}

export async function POST(req: Request) {
  const token = resolveJobToken(req);
  const expected = process.env.AUTH_ADMIN_JOB_TOKEN || process.env.CRON_SECRET;
  if (!expected || token !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Supabase admin config missing" }, { status: 500 });
  }

  const body = (await req.json().catch(() => null)) as AdminRequest | null;
  if (!body || !body.action) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  const { action, payload } = body;

  try {
    switch (action) {
      case "findUserByEmail": {
        const { email } = payload as any;
        if (!email) return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });
        const normalized = String(email).toLowerCase();
        const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        const user = (data?.users || []).find((u) => (u.email || "").toLowerCase() === normalized) || null;
        return NextResponse.json({ ok: true, data: { user } });
      }
      case "resolveIdentifierToEmail": {
        const { identifier } = payload as any;
        if (!identifier) return NextResponse.json({ ok: false, error: "Missing identifier" }, { status: 400 });
        const raw = String(identifier).trim();
        if (!raw) return NextResponse.json({ ok: true, data: { email: null } });

        if (raw.includes("@")) {
          return NextResponse.json({ ok: true, data: { email: raw.toLowerCase() } });
        }

        let email: string | null = null;
        const numeroLoginLike = /^[A-F0-9]{3}\d{4}$/i;
        if (numeroLoginLike.test(raw)) {
          const numero = raw.toUpperCase();
          const { data: byNumero, error } = await admin
            .from("profiles")
            .select("email")
            .eq("numero_login", numero)
            .limit(1);
          if (!error) email = (byNumero?.[0] as any)?.email || null;
        }

        if (!email) {
          const onlyDigits = /^\d{5,}$/;
          if (onlyDigits.test(raw)) {
            const { data: byNumero, error: e1 } = await admin
              .from("profiles")
              .select("email")
              .eq("numero_login", raw)
              .limit(1);
            if (!e1) email = (byNumero?.[0] as any)?.email || null;
          }
        }

        if (!email) {
          const onlyDigits = /^\d{5,}$/;
          if (onlyDigits.test(raw)) {
            const { data: byPhone, error: e2 } = await admin
              .from("profiles")
              .select("email")
              .eq("telefone", raw)
              .order("created_at", { ascending: false })
              .limit(1);
            if (!e2) email = (byPhone?.[0] as any)?.email || null;
          }
        }

        return NextResponse.json({ ok: true, data: { email: email ? String(email).toLowerCase() : null } });
      }
      case "createUser": {
        const { data, error } = await admin.auth.admin.createUser(payload as any);
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, data });
      }
      case "inviteUserByEmail": {
        const { email, options } = payload as any;
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, options);
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, data });
      }
      case "updateUserById": {
        const { userId, attributes } = payload as any;
        const { data, error } = await admin.auth.admin.updateUserById(userId, attributes);
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, data });
      }
      case "deleteUser": {
        const { userId } = payload as any;
        const { data, error } = await admin.auth.admin.deleteUser(userId);
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, data });
      }
      case "getUserById": {
        const { userId } = payload as any;
        const { data, error } = await admin.auth.admin.getUserById(userId);
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, data });
      }
      case "listUsers": {
        const { page, perPage } = payload as any;
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, data });
      }
      case "generateLink": {
        const { data, error } = await (admin as any).auth.admin.generateLink(payload as any);
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true, data });
      }
      case "activateStudentAccess": {
        const { codigo, bi } = payload as any;
        const code = String(codigo || "").trim();
        const biInput = String(bi || "").trim();
        if (!code || !biInput) {
          return NextResponse.json({ ok: false, error: "Missing codigo or bi" }, { status: 400 });
        }

        const { data: aluno, error } = await admin
          .from("alunos")
          .select("id, nome, escola_id, bi_numero, usuario_auth_id, profile_id, codigo_ativacao, acesso_liberado")
          .eq("codigo_ativacao", code)
          .is("deleted_at", null)
          .maybeSingle();

        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        if (!aluno) return NextResponse.json({ ok: false, error: "Código inválido" }, { status: 404 });

        const biBanco = (aluno as any).bi_numero as string | null;
        if (biBanco && biBanco.trim().toLowerCase() !== biInput.trim().toLowerCase()) {
          return NextResponse.json({ ok: false, error: "BI não confere" }, { status: 400 });
        }

        const escolaId = (aluno as any).escola_id as string;
        const login = `aluno_${(aluno as any).id}@${escolaId}.klasse.ao`.toLowerCase();
        const senha = crypto.randomBytes(6).toString("base64url").slice(0, 10);

        let userId = (aluno as any).usuario_auth_id as string | null;
        if (!userId) {
          const createRes = await admin.auth.admin.createUser({
            email: login,
            password: senha,
            email_confirm: true,
            user_metadata: {
              nome: (aluno as any).nome,
              role: "aluno",
              escola_id: escolaId,
              aluno_id: (aluno as any).id,
              primeiro_acesso: true,
            },
            app_metadata: { role: "aluno", escola_id: escolaId },
          });

          if (createRes.error) {
            if (createRes.error.message?.toLowerCase().includes("registered")) {
              const { data: listUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
              const existing = listUsers?.users?.find((u) => u.email === login);
              userId = existing?.id ?? null;
            } else {
              return NextResponse.json({ ok: false, error: createRes.error.message }, { status: 400 });
            }
          } else {
            userId = createRes.data.user?.id || null;
          }
        }

        if (!userId) return NextResponse.json({ ok: false, error: "Falha ao criar usuário" }, { status: 500 });

        await admin.from("profiles").upsert(
          {
            user_id: userId,
            email: login,
            nome: (aluno as any).nome,
            role: "aluno" as any,
            escola_id: escolaId,
            current_escola_id: escolaId,
            numero_login: login,
          } as TablesInsert<"profiles">,
          { onConflict: "user_id" }
        );

        await admin.from("escola_users").upsert(
          { escola_id: escolaId, user_id: userId, papel: "aluno" } as any,
          { onConflict: "escola_id,user_id" }
        );

        await admin
          .from("alunos")
          .update({ acesso_liberado: true, data_ativacao: new Date().toISOString(), usuario_auth_id: userId, profile_id: userId })
          .eq("id", (aluno as any).id)
          .eq("escola_id", escolaId);

        return NextResponse.json({ ok: true, data: { login } });
      }
      case "seedSuperAdmin": {
        const { email, password, nome } = payload as any;
        const normalizedEmail = String(email || "").trim().toLowerCase();
        if (!normalizedEmail || !password) {
          return NextResponse.json({ ok: false, error: "Missing email or password" }, { status: 400 });
        }

        const { data: existingUsers, error: findError } = await admin.auth.admin.listUsers();
        if (findError) return NextResponse.json({ ok: false, error: findError.message }, { status: 400 });
        const existing = existingUsers.users.find((u) => (u.email || "").toLowerCase() === normalizedEmail);

        if (existing) {
          await admin.auth.admin.deleteUser(existing.id);
          await admin.from("profiles").delete().eq("email", normalizedEmail);
        }

        const { data: newUser, error: createError } = await admin.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true,
          user_metadata: { nome, role: "super_admin" },
          app_metadata: { role: "super_admin" } as any,
        });

        if (createError || !newUser?.user) {
          return NextResponse.json({ ok: false, error: createError?.message || "Falha ao criar usuário" }, { status: 400 });
        }

        const { error: profileError } = await admin.from("profiles").upsert({
          user_id: newUser.user.id,
          email: normalizedEmail,
          nome,
          role: "super_admin",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as TablesInsert<"profiles">);

        if (profileError) {
          return NextResponse.json({ ok: false, error: profileError.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true, data: { email: normalizedEmail, password, userId: newUser.user.id } });
      }
      case "seedTest": {
        const { timestamp } = payload as any;
        const now = Number(timestamp) || Date.now();
        const escolaNome = `E2E Escola ${now}`;
        const seedPw = (payload as any)?.seedPassword || "Passw0rd!";
        const papeis = ["admin", "staff_admin", "secretaria", "financeiro", "professor", "aluno"] as const;
        const users: Record<string, { email: string; password: string; papel: string }> = {};

        const { data: escolaIns, error: escolaErr } = await (admin as any)
          .from("escolas")
          .insert({ nome: escolaNome, plano: "essencial", plano_atual: "essencial", aluno_portal_enabled: true })
          .select("id, nome")
          .single();
        if (escolaErr || !escolaIns) {
          return NextResponse.json({ ok: false, error: escolaErr?.message || "Falha ao criar escola" }, { status: 400 });
        }
        const escolaId = (escolaIns as any).id as string;

        for (const papel of papeis) {
          const email = `e2e+${papel}.${now}@example.com`;
          const { data: cu, error: cuErr } = await (admin as any).auth.admin.createUser({
            email,
            password: seedPw,
            email_confirm: true,
            user_metadata: { nome: papel },
            app_metadata: { role: papel, escola_id: escolaId },
          });
          if (cuErr) return NextResponse.json({ ok: false, error: cuErr.message }, { status: 400 });
          const userId = cu?.user?.id as string;

          try {
            await (admin as any).from("profiles").upsert({
              user_id: userId,
              email,
              nome: papel,
              role: papel as any,
              escola_id: escolaId,
            } as TablesInsert<"profiles">);
          } catch {}

          try {
            await (admin as any)
              .from("escola_users")
              .upsert({ escola_id: escolaId, user_id: userId, papel } as TablesInsert<"escola_users">, {
                onConflict: "escola_id,user_id",
              });
          } catch {}

          users[papel] = { email, password: seedPw, papel };
        }

        return NextResponse.json({ ok: true, data: { escolaId, users } });
      }
      default:
        return NextResponse.json({ ok: false, error: "Unsupported action" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
