import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { INFLUENCER_SESSION_COOKIE } from "@/lib/influencerSession";

export const dynamic = "force-dynamic";

const TriageSchema = z.object({
  status: z.enum(["em_revisao_parceiro", "pendencia_cliente", "pronto_para_klasse"]),
  document_type: z.enum(["legal", "planilha", "contrato", "logotipo", "pauta", "termo_aceite", "outro"]).optional().nullable(),
  note: z.string().trim().optional().nullable(),
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

function triageErrorMessage(error: unknown) {
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";

  if (message.includes("invalid_partner_status")) return "Status de triagem inválido.";
  if (message.includes("invalid_document_type")) return "Tipo de documento inválido.";
  if (message.includes("onboarding_not_found")) return "Ativação não encontrada para este parceiro.";
  if (message.includes("upload_not_found")) return "Upload não encontrado nesta ativação.";
  if (message.includes("upload_final_review_locked")) return "Este upload já teve revisão final da KLASSE.";
  return message || "Falha ao salvar triagem documental.";
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ codigo: string; token: string; uploadId: string }> }
) {
  const { codigo, token, uploadId } = await context.params;
  const auth = await requireInfluencerSession(codigo);
  if (!auth.ok) return auth.response;

  const parsed = TriageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Payload inválido." },
      { status: 400 }
    );
  }

  const supabase = await supabaseRouteClient();
  const { data, error } = await (supabase.rpc as any)("partner_triage_onboarding_upload", {
    p_session_id: auth.session.id,
    p_codigo: auth.session.codigo,
    p_tracking_token: token,
    p_upload_id: uploadId,
    p_status: parsed.data.status,
    p_document_type: parsed.data.document_type || null,
    p_note: parsed.data.note || null,
  });

  if (error || !data?.ok) {
    return NextResponse.json(
      { ok: false, error: triageErrorMessage(error) },
      { status: error?.code === "42501" ? 403 : 400 }
    );
  }

  return NextResponse.json({ ok: true, upload: data });
}
