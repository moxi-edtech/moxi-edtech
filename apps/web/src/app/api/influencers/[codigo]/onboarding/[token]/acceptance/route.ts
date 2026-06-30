import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { supabaseServerRole } from "@/lib/supabaseServerRole";
import { INFLUENCER_SESSION_COOKIE } from "@/lib/influencerSession";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const BUCKET = "onboarding";

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

function slugFilePart(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-_]/g, "_")
    .replace(/_{2,}/g, "_")
    .substring(0, 100);
}

function extensionForType(type: string, filename: string): string {
  const fallback = filename.split(".").pop() || "bin";
  switch (type) {
    case "application/pdf": return "pdf";
    case "image/png": return "png";
    case "image/jpeg": return "jpg";
    case "image/webp": return "webp";
    default: return fallback;
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ codigo: string; token: string }> }
) {
  const { codigo, token } = await context.params;
  const auth = await requireInfluencerSession(codigo);
  if (!auth.ok) return auth.response;

  try {
    const form = await request.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
    }

    const file = form.get("file");
    const signedBy = form.get("signed_by") as string | null;
    const signedRole = form.get("signed_role") as string | null;
    const signedAt = form.get("signed_at") as string | null;
    const notes = form.get("notes") as string | null;

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Arquivo de Termo de Aceite é obrigatório." }, { status: 400 });
    }

    if (!signedBy || !signedBy.trim()) {
      return NextResponse.json({ ok: false, error: "Nome do Diretor/Signatário é obrigatório." }, { status: 400 });
    }

    if (!signedAt || !signedAt.trim()) {
      return NextResponse.json({ ok: false, error: "Data de assinatura é obrigatória." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ ok: false, error: "Formato inválido. Use PDF, Word (DOC/DOCX) ou Imagem (PNG, JPG, WEBP)." }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ ok: false, error: "O arquivo é muito pesado. Limite de 10MB." }, { status: 400 });
    }

    // Obter Onboarding Request correspondente para validação e obter o ID
    const adminSupabase = supabaseServerRole();
    const { data: onboardingRequest, error: findError } = await adminSupabase
      .from("onboarding_requests")
      .select("id, financeiro, escola_nome")
      .eq("tracking_token", token)
      .single();

    if (findError || !onboardingRequest) {
      return NextResponse.json({ ok: false, error: "Ativação não encontrada." }, { status: 404 });
    }

    const financeiroObj = onboardingRequest.financeiro as Record<string, any> | null;
    const requestCodigo = (financeiroObj?.influencer_codigo as string || "").trim().toUpperCase();
    const sessionCodigo = auth.session.codigo.trim().toUpperCase();

    if (requestCodigo !== sessionCodigo) {
      return NextResponse.json({ ok: false, error: "Acesso proibido a este recurso." }, { status: 403 });
    }

    const ext = extensionForType(file.type, file.name);
    const safeName = slugFilePart(file.name.replace(/\.[^.]+$/, ""));
    const filePath = `acceptances/${token}/${Date.now()}_${safeName}.${ext}`;
    const bytes = await file.arrayBuffer();

    // Upload usando cliente autenticado do cliente para respeitar RLS do bucket ou admin, mas como o parceiro pode não ter RLS de gravação, usamos o admin para garantir
    const { error: uploadError } = await adminSupabase.storage.from(BUCKET).upload(filePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      return NextResponse.json({ ok: false, error: `Erro ao enviar arquivo: ${uploadError.message}` }, { status: 500 });
    }

    // Chamar RPC de validação usando o cliente de super usuário (Admin)
    const { data, error } = await (adminSupabase.rpc as any)("validate_onboarding_implantation_acceptance", {
      p_request_id: onboardingRequest.id,
      p_acceptance_term_file_path: filePath,
      p_acceptance_signed_by: signedBy.trim(),
      p_acceptance_signed_role: signedRole ? signedRole.trim() : null,
      p_acceptance_signed_at: signedAt,
      p_actor_id: auth.session.member_id ?? null,
      p_acceptance_notes: notes ? notes.trim() : null,
    });

    if (error || !data?.ok) {
      // Remover arquivo de termo de aceite se RPC falhar para evitar lixo
      await adminSupabase.storage.from(BUCKET).remove([filePath]).catch(() => null);
      
      const errMsg = data?.error === "checklist_incomplete" 
        ? "Não é possível validar o aceite com o checklist de implantação incompleto." 
        : data?.error || error?.message || "Erro desconhecido ao processar o Termo de Aceite.";
      return NextResponse.json({ ok: false, error: errMsg }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      implantation_status: "aceite_validado",
      acceptance_term_file_path: filePath,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
