import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function requireFormacaoRoles(roles: string[]) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }),
      supabase,
      userId: null,
      escolaId: null,
      role: null,
    };
  }

  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const userMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;

  const role = String(appMetadata.role ?? userMetadata.role ?? "").trim().toLowerCase();
  const tenantType = String(
    appMetadata.tenant_type ??
      userMetadata.tenant_type ??
      appMetadata.modelo_ensino ??
      userMetadata.modelo_ensino ??
      ""
  )
    .trim()
    .toLowerCase();
  const escolaId = String(appMetadata.escola_id ?? userMetadata.escola_id ?? "").trim();

  if (!escolaId) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Escola não resolvida" }, { status: 400 }),
      supabase,
      userId: user.id,
      escolaId: null,
      role,
    };
  }

  if (tenantType === "k12") {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Tenant incompatível para Formação" }, { status: 403 }),
      supabase,
      userId: user.id,
      escolaId,
      role,
    };
  }

  if (!roles.includes(role)) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 }),
      supabase,
      userId: user.id,
      escolaId,
      role,
    };
  }

  return {
    ok: true as const,
    response: null,
    supabase,
    userId: user.id,
    escolaId,
    role,
  };
}
