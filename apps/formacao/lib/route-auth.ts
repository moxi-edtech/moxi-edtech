import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveFormacaoSessionContext } from "@/lib/session-context";

export async function requireFormacaoRoles(roles: string[]) {
  const supabase = await supabaseServer();
  const session = await resolveFormacaoSessionContext();

  if (!session?.userId) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }),
      supabase,
      userId: null,
      escolaId: null,
      role: null,
    };
  }

  const role = String(session.role ?? "")
    .trim()
    .toLowerCase();
  const tenantType = String(session.tenantType ?? "")
    .trim()
    .toLowerCase();
  const escolaId = String(session.tenantId ?? "").trim();

  if (!escolaId) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Escola não resolvida" }, { status: 400 }),
      supabase,
      userId: session.userId,
      escolaId: null,
      role,
    };
  }

  if (tenantType === "k12") {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Tenant incompatível para Formação" }, { status: 403 }),
      supabase,
      userId: session.userId,
      escolaId,
      role,
    };
  }

  if (!roles.includes(role)) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 }),
      supabase,
      userId: session.userId,
      escolaId,
      role,
    };
  }

  return {
    ok: true as const,
    response: null,
    supabase,
    userId: session.userId,
    escolaId,
    role,
  };
}
