// @kf2 allow-scan
// apps/web/src/app/api/secretaria/operacoes-academicas/virada/cutover/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { buildCutoverHealthReport } from "@/lib/operacoes-academicas/cutover-health";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

const Body = z.object({
  from_session_id: z.string().uuid(),
  to_session_id: z.string().uuid(),
  conflict_strategy: z.enum(["skip", "merge", "cancel"]).optional(),
  cutover_mode: z.enum(["standard", "retroactive_pending"]).default("standard"),
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
    const authz = await authorizeEscolaAction(supabase as any, escolaId, user.id, ["configurar_escola"]);
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = Body.safeParse(body);
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 });

    // Verify the destination MED year before any cutover/RAA mutation.
    // The database activation trigger repeats this check transactionally.
    const rpcLoose = supabase.rpc.bind(supabase) as unknown as (
      fn: string,
      args?: Record<string, unknown>
    ) => Promise<LooseRpcResult>;
    const { data: medReadiness, error: medError } = await rpcLoose("med_year_cutover_preflight", {
      p_escola_id: escolaId,
      p_ano_letivo_id: parsed.data.to_session_id,
    });
    if (medError) {
      return NextResponse.json({
        ok: false, code: "MED_YEAR_PREFLIGHT_FAILED",
        error: "Não foi possível validar o calendário oficial do ano de destino.",
      }, { status: 409 });
    }
    const med = medReadiness as { ok?: boolean; code?: string; ano_base?: number } | null;
    if (med?.ok !== true) {
      return NextResponse.json({
        ok: false, code: med?.code ?? "MED_YEAR_NOT_READY",
        error: "Prepare o calendário MED, os trimestres e os vínculos dos cursos antes de ativar o ano.",
        next_action: "Configurar o calendário oficial do ano de destino.",
        calendar_readiness: med,
      }, { status: 409 });
    }

    const health = await buildCutoverHealthReport(supabase, escolaId);
    if (health.status === "BLOCKED" && parsed.data.cutover_mode !== "retroactive_pending") {
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

    const rpcName = parsed.data.cutover_mode === "retroactive_pending"
      ? "cutover_ano_letivo_retroativo"
      : "cutover_ano_letivo_v3";
    const { data, error } = await rpcLoose(rpcName, {
      p_escola_id: escolaId,
      p_from_session_id: parsed.data.from_session_id,
      p_to_session_id: parsed.data.to_session_id,
    });

    if (error) {
      console.error("[CUTOVER-FINAL] Erro na RPC:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const { data: reclassificationSync, error: reclassificationSyncError } = await rpcLoose("sync_reclassificacoes_virada", {
      p_escola_id: escolaId,
      p_origem_session_id: parsed.data.from_session_id,
      p_destino_session_id: parsed.data.to_session_id,
    });
    if (reclassificationSyncError) {
      console.error("[CUTOVER-FINAL] Falha ao sincronizar centro de resolução:", reclassificationSyncError.message);
    }

    return NextResponse.json({
      ok: true,
      result: {
        ...(data as Record<string, unknown>),
        reclassification_sync: reclassificationSyncError
          ? { ok: false, error: reclassificationSyncError.message }
          : reclassificationSync,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
