// apps/web/src/app/api/seed-superadmin/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase"



const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚠️ precisa da chave service_role
);

export async function GET() {
  const email = "superadmin@moxinexa.com";
  const password = "12345678";

  const { data: user, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userId = user.user?.id;

  await supabase.from("profiles").upsert({
    user_id: userId!,
    email,
    nome: "Super Admin",
    role: "super_admin",
  });

  return NextResponse.json({ ok: true, userId });
}
