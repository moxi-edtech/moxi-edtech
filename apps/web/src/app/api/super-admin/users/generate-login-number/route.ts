// src/app/api/debug/generate-numero-login/route.ts (exemplo de caminho)
import { NextResponse } from "next/server";
import { generateNumeroLogin } from "@/lib/generateNumeroLogin";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

type UserRole = Database["public"]["Enums"]["user_role"];

export async function GET(req: Request) {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Server misconfigured: missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 500 }
    );
  }

  // Client com service_role → ideal pra função RPC que precisa ver tudo
  const admin = createClient<Database>(supabaseUrl, serviceRoleKey);

  const { searchParams } = new URL(req.url);
  const escolaId = searchParams.get("escolaId") ?? "";
  const roleParam = searchParams.get("role") ?? "";

  if (!escolaId.trim() || !roleParam.trim()) {
    return NextResponse.json(
      { ok: false, error: "Missing escolaId or role" },
      { status: 400 }
    );
  }

  const userRole = roleParam as UserRole;

  try {
    const numeroLogin = await generateNumeroLogin(escolaId.trim(), userRole, {
      client: admin,             // 👈 agora segue a mesma dinâmica da função
      useDatabaseFunction: true, // usa RPC primeiro (default, mas deixei explícito)
      useCache: true,
    });

    return NextResponse.json({ ok: true, numeroLogin });
  } catch (error: any) {
    console.error("Erro ao gerar numero_login:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Erro ao gerar numero_login",
      },
      { status: 500 }
    );
  }
}
