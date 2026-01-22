// @kf2 allow-scan
// apps/web/src/app/api/seed-superadmin/route.ts
import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database, TablesInsert } from "~types/supabase";

function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const email = "superadmin@moxinexa.com";
const password = "12345678";
const nome = "Super Admin";

// early guard to avoid failing the build when env vars are missing
export async function GET(request: Request) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase not configured (SUPABASE_URL or key missing)" },
      { status: 503 }
    );
  }

  const enabled =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ENABLE_SEED === "1";
  if (!enabled) {
    return NextResponse.json(
      { ok: false, error: "🚫 Rota desativada" },
      { status: 403 }
    );
  }

  try {
    // 1. Verifica se já existe no auth.users
    const { data: existingUsers, error: findError } =
      await supabase.auth.admin.listUsers();
    if (findError) throw findError;

    const existing = existingUsers.users.find((u) => u.email === email);

    if (existing) {
      console.log("🔥 Deletando usuário antigo:", existing.id);
      await supabase.auth.admin.deleteUser(existing.id);

      // 🚨 limpa também o profile antigo para não dar conflito
      await supabase.from("profiles").delete().eq("email", email);
    }

    // 2. Cria usuário fresh
    const { data: newUser, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nome,
          role: "super_admin", // mantém em user_metadata para compatibilidade
        },
        // Garantir que o JWT contenha a claim usada pelas RLS (app_metadata.role)
        // Supabase Admin API aceita app_metadata em createUser/updateUser
        // Ref: https://supabase.com/docs/reference/javascript/auth-admin-createuser
        app_metadata: {
          role: "super_admin",
        } as any,
      });
    if (createError || !newUser.user) throw createError;

    // 3. Garante profile vinculado
    const { error: profileError } = await supabase.from("profiles").upsert({
      user_id: newUser.user.id,
      email,
      nome,
      role: "super_admin",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as TablesInsert<"profiles">);

    if (profileError) throw profileError;

    return NextResponse.json({
      ok: true,
      message: "✅ SuperAdmin recriado com sucesso!",
      email,
      password,
      userId: newUser.user.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ Erro seed-superadmin:", err);
    return NextResponse.json(
      { ok: false, error: message || "Erro desconhecido" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase not configured (SUPABASE_URL or key missing)" },
      { status: 503 }
    );
  }

  const enabled =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ENABLE_SEED === "1";
  if (!enabled) {
    return NextResponse.json(
      { ok: false, error: "🚫 Rota desativada" },
      { status: 403 }
    );
  }

  try {
    // 1. Verifica se já existe no auth.users
    const { data: existingUsers, error: findError } =
      await supabase.auth.admin.listUsers();
    if (findError) throw findError;

    const existing = existingUsers.users.find((u) => u.email === email);

    if (existing) {
      console.log("🔥 Deletando usuário antigo:", existing.id);
      await supabase.auth.admin.deleteUser(existing.id);

      // 🚨 limpa também o profile antigo para não dar conflito
      await supabase.from("profiles").delete().eq("email", email);
    }

    // 2. Cria usuário fresh
    const { data: newUser, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nome,
          role: "super_admin", // mantém em user_metadata para compatibilidade
        },
        app_metadata: {
          role: "super_admin",
        } as any,
      });
    if (createError || !newUser.user) throw createError;

    // 3. Garante profile vinculado
    const { error: profileError } = await supabase.from("profiles").upsert({
      user_id: newUser.user.id,
      email,
      nome,
      role: "super_admin",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as TablesInsert<"profiles">);

    if (profileError) throw profileError;

    return NextResponse.json({
      ok: true,
      message: "✅ SuperAdmin recriado com sucesso!",
      email,
      password,
      userId: newUser.user.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("❌ Erro seed-superadmin:", err);
    return NextResponse.json(
      { ok: false, error: message || "Erro desconhecido" },
      { status: 500 }
    );
  }
}
