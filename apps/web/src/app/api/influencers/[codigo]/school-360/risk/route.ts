import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { INFLUENCER_SESSION_COOKIE } from "@/lib/influencerSession";
import { supabaseRouteClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type RiskItem = {
  onboarding_request_id?: string;
  risk_score?: number;
  risk_level?: "baixo" | "medio" | "alto";
  risk_reasons?: string[];
  snapshot?: Record<string, unknown>;
};

function isRiskItem(value: unknown): value is RiskItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.onboarding_request_id === "string" && candidate.onboarding_request_id.length > 0;
}

export async function POST(request: Request, context: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await context.params;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(INFLUENCER_SESSION_COOKIE)?.value ?? "";

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Sessão expirada." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const items = Array.isArray(body?.items) ? body.items.filter(isRiskItem).slice(0, 100) : [];

    if (items.length === 0) {
      return NextResponse.json({ ok: true, updated: 0 });
    }

    const supabase = await supabaseRouteClient();
    const { data, error } = await (supabase.rpc as any)("sync_influencer_school_360_risk", {
      p_session_id: sessionId,
      p_codigo: codigo,
      p_items: items,
    });

    if (error || !data?.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error || error?.message || "Falha ao sincronizar risco." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, updated: data.updated ?? 0 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro interno ao sincronizar risco." },
      { status: 500 },
    );
  }
}
