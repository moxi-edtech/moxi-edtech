import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { INFLUENCER_SESSION_COOKIE } from "@/lib/influencerSession";

export const dynamic = "force-dynamic";

const BUCKET = "onboarding";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

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

function slugFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "documento";
}

function extensionForType(type: string, fileName: string) {
  if (type === "application/pdf") return "pdf";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/jpeg" || type === "image/jpg") return "jpg";
  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (type === "application/msword") return "doc";
  const fallback = fileName.split(".").pop()?.toLowerCase();
  return fallback || "bin";
}

async function getLeadFileInfo(supabase: any, codigo: string, leadId: string) {
  const { data, error } = await supabase
    .from("crm_leads")
    .select("proposal_file_path, proposal_file_name")
    .eq("afiliado_codigo", codigo.trim().toUpperCase())
    .eq("id", leadId)
    .maybeSingle();

  if (error) {
    return { ok: false as const, error: error.message };
  }

  if (!data) {
    return { ok: false as const, error: "Lead não encontrado para este parceiro." };
  }

  return {
    ok: true as const,
    data: data as { proposal_file_path: string | null; proposal_file_name: string | null },
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ codigo: string; leadId: string }> }
) {
  const { codigo, leadId } = await context.params;
  const auth = await requireInfluencerSession(codigo);
  if (!auth.ok) return auth.response;

  try {
    const supabase = await supabaseRouteClient();
    const lead = await getLeadFileInfo(supabase, codigo, leadId);
    if (!lead.ok) {
      return NextResponse.json({ ok: false, error: lead.error }, { status: 404 });
    }

    const filePath = lead.data.proposal_file_path;
    if (!filePath) {
      return NextResponse.json({ ok: false, error: "Nenhum documento comercial anexado." }, { status: 404 });
    }

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 60 * 30);
    if (error || !data?.signedUrl) {
      return NextResponse.json({ ok: false, error: "Falha ao gerar acesso ao documento." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      signedUrl: data.signedUrl,
      fileName: lead.data.proposal_file_name,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ codigo: string; leadId: string }> }
) {
  const { codigo, leadId } = await context.params;
  const auth = await requireInfluencerSession(codigo);
  if (!auth.ok) return auth.response;

  try {
    const form = await request.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Arquivo obrigatório." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ ok: false, error: "Formato inválido. Use PDF, DOC, DOCX, PNG, JPG ou WEBP." }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ ok: false, error: "O arquivo é muito pesado. Limite de 10MB." }, { status: 400 });
    }

    const supabase = await supabaseRouteClient();
    const previous = await getLeadFileInfo(supabase, codigo, leadId);
    if (!previous.ok) {
      return NextResponse.json({ ok: false, error: previous.error }, { status: 404 });
    }

    const ext = extensionForType(file.type, file.name);
    const safeName = slugFilePart(file.name.replace(/\.[^.]+$/, ""));
    const filePath = `crm-leads/${codigo.trim().toUpperCase()}/${leadId}/${Date.now()}_${safeName}.${ext}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      return NextResponse.json({ ok: false, error: `Erro ao enviar arquivo: ${uploadError.message}` }, { status: 500 });
    }

    const { data, error } = await (supabase.rpc as any)("attach_influencer_crm_lead_proposal", {
      p_session_id: auth.session.id,
      p_codigo: auth.session.codigo,
      p_lead_id: leadId,
      p_file_path: filePath,
      p_file_name: file.name,
    });

    if (error || !data?.ok) {
      await supabase.storage.from(BUCKET).remove([filePath]).catch(() => null);
      return NextResponse.json({ ok: false, error: "Falha ao registrar anexo comercial." }, { status: 400 });
    }

    if (previous.data.proposal_file_path) {
      await supabase.storage.from(BUCKET).remove([previous.data.proposal_file_path]).catch(() => null);
    }

    const { data: signedData } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 60 * 30);

    return NextResponse.json({
      ok: true,
      fileName: file.name,
      commercial_status: data.commercial_status,
      signedUrl: signedData?.signedUrl ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
