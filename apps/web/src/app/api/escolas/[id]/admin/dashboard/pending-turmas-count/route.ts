import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "~types/supabase";

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

  const supabase = createRouteHandlerClient<Database>({ cookies });

  try {
    const { data, error } = await supabase.rpc("get_pending_turmas_count", {
      p_escola_id: escolaId,
    }).single();

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
