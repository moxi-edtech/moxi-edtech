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
    if (data.request.escola_id) {
      const { data: handoff, error: handoffError } = await (supabase.rpc as any)(
        "get_onboarding_public_handoff",
        { p_token: token }
      );

      if (!handoffError && handoff?.ok) {
        operationalReadiness = handoff.operational_readiness ?? null;
        setupHandoff = handoff.setup_handoff ?? null;
      } else {
        console.warn("Error fetching token-bound public handoff:", handoffError ?? handoff?.error);
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
