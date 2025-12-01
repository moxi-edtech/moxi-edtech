import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export async function GET() {
  const supa = await createRouteClient();
  const { data: userRes } = await supa.auth.getUser();
  const authUser = userRes?.user;
  if (!authUser) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!adminUrl || !serviceKey) {
    return NextResponse.json({ error: "SUPABASE configuration missing" }, { status: 500 });
  }
  const admin = createAdminClient<Database>(adminUrl, serviceKey);

  // Lista escolas às quais o usuário pertence
  const escolaIds: string[] = [];
  try {
    const { data: vincs } = await admin
      .from("escola_usuarios")
      .select("escola_id")
      .eq("user_id", authUser.id);
    for (const v of vincs || []) {
      if (v && (v as any).escola_id) escolaIds.push(String((v as any).escola_id));
    }
  } catch {}
  if (escolaIds.length === 0) {
    // Fallback: tenta escola do perfil
    try {
      const { data: prof } = await admin
        .from("profiles")
        .select("current_escola_id, escola_id")
        .eq("user_id", authUser.id)
        .limit(1);
      const e = (prof?.[0] as any)?.current_escola_id || (prof?.[0] as any)?.escola_id || null;
      if (e) escolaIds.push(String(e));
    } catch {}
  }

  if (escolaIds.length === 0) return NextResponse.json({ items: [] });

  const { data, error } = await admin
    .from("import_migrations")
    .select(
      `
        id,
        escola_id,
        file_name,
        status,
        total_rows,
        imported_rows,
        error_rows,
        processed_at,
        created_at
      `,
    )
    .in("escola_id", escolaIds)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
