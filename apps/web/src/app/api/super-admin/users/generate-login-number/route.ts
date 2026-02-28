// @kf2 allow-scan
// src/app/api/debug/generate-numero-login/route.ts (exemplo de caminho)
import crypto from "crypto";
import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";

type UserRole = Database["public"]["Enums"]["user_role"];

const ROLE_START: Record<UserRole, number> = {
  admin: 1,
  aluno: 1001,
  professor: 2001,
  secretaria: 3001,
  financeiro: 4001,
  encarregado: 5001,
  super_admin: 1,
  global_admin: 1,
};

const derivePrefix = (escolaId: string) => {
  return crypto.createHash("md5").update(escolaId).digest("hex").slice(0, 3);
};

export async function GET(req: Request) {
  const s = await supabaseServer();
  const { data: sess } = await s.auth.getUser();
  const user = sess?.user;
  if (!user) {
    return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  }
  const { data: rows } = await s
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);
  const role = (rows?.[0] as any)?.role as string | undefined;
  if (!isSuperAdminRole(role)) {
    return NextResponse.json({ ok: false, error: 'Somente Super Admin' }, { status: 403 });
  }

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

  const { data, error } = await (s as any).rpc("generate_unique_numero_login", {
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
