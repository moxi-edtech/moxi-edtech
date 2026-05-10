// @kf2 allow-scan
// apps/web/src/app/api/secretaria/operacoes-academicas/virada/cutover/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { buildCutoverHealthReport } from "@/lib/operacoes-academicas/cutover-health";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

const Body = z.object({
  from_session_id: z.string().uuid(),
  to_session_id: z.string().uuid(),
  conflict_strategy: z.enum(["skip", "merge", "cancel"]).optional(),
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

    const health = await buildCutoverHealthReport(supabase, escolaId);
    if (health.status === "BLOCKED") {
      return NextResponse.json(
        {
          ok: false,
          code: "CUTOVER_HEALTH_BLOCKED",
          error: "A virada está bloqueada por pendências operacionais.",
          blockers: health.blockers,
          report: health,
        },
        { status: 409 }
      );
    }

    const rpcLoose = supabase.rpc.bind(supabase) as unknown as (
      fn: string,
      args?: Record<string, unknown>
    ) => Promise<LooseRpcResult>;

    const { data, error } = await rpcLoose("cutover_ano_letivo_v3", {
      p_escola_id: escolaId,
      p_from_session_id: parsed.data.from_session_id,
      p_to_session_id: parsed.data.to_session_id,
    });

    if (error) {
      console.error("[CUTOVER-FINAL] Erro na RPC:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
