import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { INFLUENCER_SESSION_COOKIE } from "@/lib/influencerSession";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  items: z.array(z.object({
    code: z.string().trim().min(1),
    label: z.string().trim().optional(),
    completed: z.boolean().optional(),
    note: z.string().trim().optional().nullable(),
    completed_at: z.string().datetime({ offset: true }).optional().nullable(),
  })).min(1),
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

function getChecklistErrorMessage(errorCode: string | undefined) {
  switch (errorCode) {
    case "onboarding_not_found":
      return "Ativação não encontrada para este parceiro.";
    case "session_not_found":
      return "Sessão expirada.";
    default:
      return "Falha ao salvar o checklist de implantação.";
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ codigo: string; token: string }> }
) {
  const { codigo, token } = await context.params;
  const auth = await requireInfluencerSession(codigo);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Checklist inválido." }, { status: 400 });
    }

    const items = parsed.data.items.map((item) => ({
      code: item.code,
      completed: item.completed ?? false,
      note: item.note ?? null,
      completed_at: item.completed ? item.completed_at ?? null : null,
    }));

    const supabase = await supabaseRouteClient();
    const { data, error } = await (supabase.rpc as any)("update_influencer_onboarding_implantation_checklist", {
      p_session_id: auth.session.id,
      p_codigo: auth.session.codigo,
      p_tracking_token: token,
      p_items: items,
    });

    if (error || !data?.ok) {
      const message = getChecklistErrorMessage(data?.error || error?.message);
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      implantation_status: data.implantation_status,
      completed_count: data.completed_count,
      total_count: data.total_count,
      checklist: data.checklist ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
