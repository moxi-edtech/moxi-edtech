// @kf2 allow-scan
// apps/web/src/app/api/secretaria/operacoes-academicas/virada/clone-structure/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

const Body = z.object({
  from_session_id: z.string().uuid(),
  to_session_id: z.string().uuid(),
  readjust_percent: z.number().min(0).max(500).default(0),
});

type LooseRpcResult = {
  data: unknown;
  error: { message: string } | null;
};

export async function POST(request: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const parsed = Body.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });

    const rpcLoose = supabase.rpc.bind(supabase) as unknown as (
      fn: string,
      args?: Record<string, unknown>
    ) => Promise<LooseRpcResult>;

    const { data, error } = await rpcLoose("clone_academic_structure_v1", {
      p_escola_id: escolaId,
      p_from_session_id: parsed.data.from_session_id,
      p_to_session_id: parsed.data.to_session_id,
      p_readjust_percent: parsed.data.readjust_percent
    });

    if (error) {
      console.error("[CLONE-STRUCTURE] Erro na RPC:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
