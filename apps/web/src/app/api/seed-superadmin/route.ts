// apps/web/src/app/api/seed-superadmin/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const email = "superadmin@moxinexa.com";
const password = "12345678";
const nome = "Super Admin";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "🚫 Rota desativada em produção" },
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
      role: "super_admin" // ⚠️ ADICIONE ESTA LINHA
    },
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
    });

    if (profileError) throw profileError;

    return NextResponse.json({
      ok: true,
      message: "✅ SuperAdmin recriado com sucesso!",
      email,
      password,
      userId: newUser.user.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("❌ Erro seed-superadmin:", err);
    return NextResponse.json(
      { ok: false, error: message || "Erro desconhecido" },
      { status: 500 }
    );
  }
}
