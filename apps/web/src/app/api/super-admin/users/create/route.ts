import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "~types/supabase";
import { recordAuditServer } from "@/lib/audit";

// Creates a supabase client with service role for admin operations (server-only)
const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
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

    // 1) Create auth user
    const isStrongPassword = (pwd: string) => {
      return (
        typeof pwd === 'string' &&
        pwd.length >= 8 &&
        /[A-Z]/.test(pwd) &&
        /[a-z]/.test(pwd) &&
        /\d/.test(pwd) &&
        /[^A-Za-z0-9]/.test(pwd)
      )
    }

    const generateStrongPassword = (len = 12) => {
      const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      const lower = 'abcdefghijklmnopqrstuvwxyz'
      const nums = '0123456789'
      const special = '!@#$%^&*()-_=+[]{};:,.?'
      const all = upper + lower + nums + special
      const pick = (set: string) => set[Math.floor(Math.random() * set.length)]
      let pwd = pick(upper) + pick(lower) + pick(nums) + pick(special)
      for (let i = pwd.length; i < len; i++) pwd += pick(all)
      // shuffle
      return pwd.split('').sort(() => Math.random() - 0.5).join('')
    }

    // Validate provided temp password or generate a strong one
    let password = (tempPassword && tempPassword.trim()) || ''
    if (password) {
      if (!isStrongPassword(password)) {
        return NextResponse.json(
          { ok: false, error: 'Senha temporária não atende aos requisitos: mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.' },
          { status: 400 }
        )
      }
    } else {
      password = generateStrongPassword(12)
    }
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { nome, role: roleEnum, must_change_password: true },
    });
    if (authError || !authUser?.user) {
      return NextResponse.json(
        { ok: false, error: authError?.message || "Falha ao criar usuário no Auth" },
        { status: 400 }
      );
    }

    // 2) Create profile
    const { error: profileError } = await admin.from("profiles").insert([
      {
        user_id: authUser.user.id,
        email: email.trim().toLowerCase(),
        nome: nome.trim(),
        telefone: telefone || null,
        role: roleEnum,
      },
    ] as TablesInsert<"profiles">[]);
    if (profileError) {
      return NextResponse.json(
        { ok: false, error: profileError.message },
        { status: 400 }
      );
    }

    // 3) Link to school
    const { error: vinculoError } = await admin.from("escola_usuarios").insert([
      {
        escola_id: escolaId,
        user_id: authUser.user.id,
        papel,
      },
    ] as TablesInsert<"escola_usuarios">[]);
    if (vinculoError) {
      return NextResponse.json(
        { ok: false, error: vinculoError.message },
        { status: 400 }
      );
    }

    // Auditoria: usuário criado pelo Super Admin
    recordAuditServer({
      escolaId,
      portal: 'super_admin',
      action: 'USUARIO_CRIADO',
      entity: 'usuario',
      entityId: authUser.user.id,
      details: { papel, roleEnum, email: email.trim().toLowerCase() }
    }).catch(() => null)

    return NextResponse.json({ ok: true, userId: authUser.user.id, tempPassword: password });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
