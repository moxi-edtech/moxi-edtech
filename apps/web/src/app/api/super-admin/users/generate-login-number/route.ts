// src/app/api/debug/generate-numero-login/route.ts (exemplo de caminho)
import crypto from "crypto";
import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

type UserRole = Database["public"]["Enums"]["user_role"];

const ROLE_START: Record<UserRole, number> = {
  admin: 1,
  aluno: 1001,
  professor: 2001,
  secretaria: 3001,
  financeiro: 4001,
  super_admin: 1,
  global_admin: 1,
};

const derivePrefix = (escolaId: string) => {
  return crypto.createHash("md5").update(escolaId).digest("hex").slice(0, 3);
};

export async function GET(req: Request) {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Configuração ausente: defina SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 500 }
    );
  }

  const admin = createClient<Database>(supabaseUrl, serviceRoleKey);

  const { searchParams } = new URL(req.url);
  const escolaId = searchParams.get("escolaId")?.trim() ?? "";
  const roleParam = searchParams.get("role")?.trim() ?? "";

  if (!escolaId || !roleParam) {
    return NextResponse.json(
      { ok: false, error: "Parâmetros escolaId e role são obrigatórios" },
      { status: 400 }
    );
  }

  const userRole = roleParam as UserRole;

  if (!Object.prototype.hasOwnProperty.call(ROLE_START, userRole)) {
    return NextResponse.json(
      { ok: false, error: `Role inválida: ${roleParam}` },
      { status: 400 }
    );
  }

  const prefix = derivePrefix(escolaId);
  const start = ROLE_START[userRole];

  const { data, error } = await admin.rpc("generate_unique_numero_login", {
    p_escola_id: escolaId,
    p_role: userRole,
    p_prefix: prefix,
    p_start: start,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  const numeroLogin = typeof data === "string" ? data : String(data ?? "");

  if (!numeroLogin) {
    return NextResponse.json(
      { ok: false, error: "Número de login não gerado" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, numeroLogin });
}
