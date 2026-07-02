import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json({ ok: false, error: "Token inválido" }, { status: 400 });
    }

    const supabase = await supabaseRouteClient();
    const { data, error } = await (supabase.rpc as any)("get_onboarding_tracking_payload", {
      p_token: token,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    if (!data?.ok || !data.request) {
      return NextResponse.json({ ok: false, error: data?.error || "Pedido não encontrado" }, { status: 404 });
    }

    let operationalReadiness = null;
    let setupHandoff: {
      ano_letivo: number;
      onboarding_finalizado: boolean;
      needs_academic_setup: boolean;
      completion_percent: number;
      next_action: any;
      blockers: any[];
      badges: Record<string, boolean>;
    } | null = null;
    const escolaId = data.request.escola_id;
    if (escolaId) {
      const { data: readiness, error: readinessError } = await (supabase.rpc as any)(
        "get_school_operational_readiness",
        {
          p_escola_id: escolaId,
          p_ano_letivo: null
        }
      );
      if (!readinessError) {
        operationalReadiness = readiness;
      } else {
        console.warn("Error fetching operational readiness for onboarding:", readinessError);
      }

      const { data: escolaRow, error: escolaError } = await supabase
        .from("escolas")
        .select("onboarding_finalizado, needs_academic_setup")
        .eq("id", escolaId)
        .maybeSingle();

      if (escolaError) {
        console.warn("Error fetching onboarding lifecycle for public handoff:", escolaError);
      } else {
        const { data: activeYearRows, error: activeYearError } = await supabase
          .from("anos_letivos")
          .select("ano")
          .eq("escola_id", escolaId)
          .eq("ativo", true)
          .order("created_at", { ascending: false })
          .limit(1);

        if (activeYearError) {
          console.warn("Error fetching active school year for public handoff:", activeYearError);
        } else {
          const activeYear = Array.isArray(activeYearRows) ? activeYearRows[0] : activeYearRows;
          const anoLetivo = typeof activeYear?.ano === "number" ? activeYear.ano : null;

          if (anoLetivo) {
            const { data: setupState, error: setupStateError } = await (supabase.rpc as any)("get_setup_state", {
              p_escola_id: escolaId,
              p_ano_letivo: anoLetivo,
            });

            if (setupStateError) {
              console.warn("Error fetching setup state for public handoff:", setupStateError);
            } else {
              const badges = setupState?.badges ?? {};
              const setupSteps = [
                Boolean(badges.ano_letivo_ok),
                Boolean(badges.periodos_ok),
                Boolean(badges.avaliacao_ok),
                Boolean(badges.curriculo_published_ok),
                Boolean(badges.turmas_ok),
              ];
              const completionPercent = Math.round((setupSteps.filter(Boolean).length / setupSteps.length) * 100);

              setupHandoff = {
                ano_letivo: anoLetivo,
                onboarding_finalizado: Boolean(escolaRow?.onboarding_finalizado),
                needs_academic_setup:
                  typeof escolaRow?.needs_academic_setup === "boolean"
                    ? escolaRow.needs_academic_setup
                    : !Boolean(escolaRow?.onboarding_finalizado),
                completion_percent: completionPercent,
                next_action: setupState?.next_action ?? null,
                blockers: Array.isArray(setupState?.blockers) ? setupState.blockers : [],
                badges,
              };
            }
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      request: data.request,
      steps: data.steps || [],
      uploads: data.uploads || [],
      operational_readiness: operationalReadiness,
      setup_handoff: setupHandoff,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro interno" }, { status: 500 });
  }
}
