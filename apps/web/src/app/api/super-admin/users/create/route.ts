import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "~types/supabase";

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
    }: {
      nome: string;
      email: string;
      telefone?: string | null;
      papel: string;
      escolaId: string;
      roleEnum: Database["public"]["Enums"]["user_role"];
    } = body;

    // 1) Create auth user
    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: Math.random().toString(36).slice(-10),
      email_confirm: false,
      user_metadata: { nome, role: roleEnum },
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

    return NextResponse.json({ ok: true, userId: authUser.user.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
