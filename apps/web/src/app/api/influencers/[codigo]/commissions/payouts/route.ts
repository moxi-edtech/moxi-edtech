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
    .slice(0, 48) || "recibo";
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

function parseCommissionIds(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => String(value ?? "").trim())
      .filter((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value));
  } catch {
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value));
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await context.params;
  const auth = await requireInfluencerSession(codigo);
  if (!auth.ok) return auth.response;

  try {
    const form = await request.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
    }

    const commissionIds = parseCommissionIds(form.get("commission_ids"));
    if (commissionIds.length === 0) {
      return NextResponse.json({ ok: false, error: "Selecione pelo menos uma comissão aprovada." }, { status: 400 });
    }

    const file = form.get("receipt");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Fatura/recibo obrigatório para solicitar payout." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ ok: false, error: "Formato inválido. Use PDF, DOC, DOCX, PNG, JPG ou WEBP." }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ ok: false, error: "O arquivo é muito pesado. Limite de 10MB." }, { status: 400 });
    }

    const supabase = await supabaseRouteClient();
    const ext = extensionForType(file.type, file.name);
    const safeName = slugFilePart(file.name.replace(/\.[^.]+$/, ""));
    const filePath = `partner-payouts/${auth.session.codigo}/${Date.now()}_${safeName}.${ext}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      return NextResponse.json({ ok: false, error: `Erro ao enviar arquivo: ${uploadError.message}` }, { status: 500 });
    }

    const { data, error } = await (supabase.rpc as any)("create_influencer_partner_commission_payout", {
      p_session_id: auth.session.id,
      p_codigo: auth.session.codigo,
      p_commission_ids: commissionIds,
      p_receipt_file_path: filePath,
      p_receipt_file_name: file.name,
      p_receipt_file_type: file.type,
      p_receipt_file_size: file.size,
    });

    if (error || !data?.ok) {
      await supabase.storage.from(BUCKET).remove([filePath]).catch(() => null);
      const message =
        data?.error === "commission_not_available_for_payout"
          ? "Uma ou mais comissões já foram solicitadas, não estão aprovadas ou não pertencem ao parceiro."
          : data?.error === "receipt_required"
            ? "Fatura/recibo obrigatório para solicitar payout."
            : data?.error === "no_commissions_selected"
              ? "Selecione pelo menos uma comissão aprovada."
              : error?.message || "Falha ao solicitar payout.";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      payout: {
        id: data.payout_id,
        status: data.status,
        total_kz: data.total_kz,
        commission_count: data.commission_count,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
