import { NextResponse } from "next/server";
import { createClient } from "~/lib/supabase/server";
import type { Database } from "~types/supabase";
import { applyKf2ListInvariants } from "@/lib/kf2";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;

  if (!escolaId) {
    return NextResponse.json(
      { error: "O ID da escola é obrigatório." },
      { status: 400 }
    );
  }

  const supabase = createClient();

  try {
    let rpcQuery = supabase.rpc("get_pending_turmas_count", {
      p_escola_id: escolaId,
    });

    rpcQuery = applyKf2ListInvariants(rpcQuery, { defaultLimit: 1 });

    const { data, error } = await rpcQuery.single();

    if (error) {
      console.error("[API pending-turmas-count] Erro ao chamar RPC get_pending_turmas_count:", error);
      throw new Error(
        `Falha ao buscar contagem de turmas pendentes: ${error.message}`
      );
    }

    return NextResponse.json({ ok: true, count: data || 0 });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e.message || "Ocorreu um erro no servidor.",
      },
      { status: 500 }
    );
  }
}
