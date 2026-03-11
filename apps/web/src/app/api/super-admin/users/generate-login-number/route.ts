// @kf2 allow-scan
// src/app/api/debug/generate-numero-login/route.ts (exemplo de caminho)
import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";

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

  const info =
    roleParam === "aluno"
      ? "Login do aluno é definido na matrícula (numero_processo)."
      : "Usuários não-aluno autenticam com email; não há login numérico.";

  return NextResponse.json({ ok: false, error: info }, { status: 400 });
}
