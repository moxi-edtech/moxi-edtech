import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { INFLUENCER_SESSION_COOKIE } from "@/lib/influencerSession";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  onboardingToken: z.string().trim().min(1),
  stepCode: z.string().trim().optional().nullable(),
  notes: z.string().trim().min(1),
});

async function requireInfluencerSession(codigo: string) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(INFLUENCER_SESSION_COOKIE)?.value ?? "";
  if (!sessionId) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Sessão expirada." }, { status: 401 }),
    };
  }

  const supabase = await supabaseRouteClient();
  const { data, error } = await (supabase.rpc as any)("get_influencer_portal_session", {
    p_session_id: sessionId,
    p_codigo: codigo.trim().toUpperCase(),
  });

  if (error || !data?.ok || !data?.session) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Sessão expirada." }, { status: 401 }),
    };
  }

  return { ok: true as const, session: data.session };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await context.params;
  const auth = await requireInfluencerSession(codigo);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
    }

    const supabase = await supabaseRouteClient();
    const { data, error } = await (supabase.rpc as any)("log_onboarding_call_followup_by_session", {
      p_session_id: auth.session.id,
      p_codigo: auth.session.codigo,
      p_onboarding_token: parsed.data.onboardingToken,
      p_step_code: parsed.data.stepCode ?? null,
      p_notes: parsed.data.notes,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: "Erro ao registrar a ligação." }, { status: 400 });
    }

    if (!data?.ok) {
      return NextResponse.json({ ok: false, error: data?.error || "Erro ao registrar a ligação." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
