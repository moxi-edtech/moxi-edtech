import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A única fonte de autorização académica do histórico transitado é a RPC.
 * Não usar roleMatchesAllowedRoles() nem user_has_role_in_school(): esses
 * helpers têm herança de papéis destinada a outros módulos.
 */
export async function requireHistoricoTransitadoPermission(
  supabase: SupabaseClient<any>,
  escolaId: string,
): Promise<NextResponse | null> {
  try {
    const { data, error } = await (supabase.rpc as any)(
      "can_manage_historico_transitado",
      { p_escola_id: escolaId },
    );

    if (error) {
      console.error("[historico-transitado] authz RPC failed", { code: error.code });
      return NextResponse.json(
        { ok: false, error: "Não foi possível validar as permissões académicas." },
        { status: 503 },
      );
    }

    if (data !== true) {
      return NextResponse.json(
        { ok: false, error: "Não tem permissão para gerir o histórico académico." },
        { status: 403 },
      );
    }
    return null;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Não foi possível validar as permissões académicas." },
      { status: 503 },
    );
  }
}
