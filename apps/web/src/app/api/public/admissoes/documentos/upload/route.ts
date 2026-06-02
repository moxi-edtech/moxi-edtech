import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerRole } from "@/lib/supabaseServerRole";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  escolaId: z.string().uuid(),
  candidaturaId: z.string().uuid(),
  label: z.string().trim().min(1).max(120),
});

const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_BYTES = 2 * 1024 * 1024;

function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip") || "unknown";
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

function extensionForType(type: string) {
  if (type === "application/pdf") return "pdf";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse({
    escolaId: form.get("escolaId"),
    candidaturaId: form.get("candidaturaId"),
    label: form.get("label"),
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Arquivo obrigatório." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ ok: false, error: "Formato não suportado. Use PDF, JPG, PNG ou WebP." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ ok: false, error: "O ficheiro é muito pesado. O limite é 2MB." }, { status: 400 });
  }

  const { escolaId, candidaturaId, label } = parsed.data;
  const supabase = supabaseServerRole();

  const { data: rateLimit, error: rateLimitError } = await supabase.rpc("check_public_rate_limit", {
    p_scope: "admissao_document_upload",
    p_key: `${escolaId}:${candidaturaId}:${getClientIp(req)}`,
    p_limit: 20,
    p_window_seconds: 600,
    p_block_seconds: 900,
  });
  if (rateLimitError) {
    return NextResponse.json({ ok: false, error: "Erro ao validar envio." }, { status: 500 });
  }
  if (
    typeof rateLimit === "object" &&
    rateLimit !== null &&
    !Array.isArray(rateLimit) &&
    "allowed" in rateLimit &&
    rateLimit.allowed !== true
  ) {
    return NextResponse.json(
      { ok: false, error: "Muitos envios. Aguarde alguns minutos e tente novamente." },
      { status: 429 }
    );
  }

  const { data: escola } = await supabase
    .from("escolas")
    .select("id")
    .eq("id", escolaId)
    .maybeSingle();
  if (!escola) {
    return NextResponse.json({ ok: false, error: "Escola não encontrada." }, { status: 404 });
  }

  const fileName = `${slugFilePart(label)}_${Date.now()}.${extensionForType(file.type)}`;
  const filePath = `${escolaId}/${candidaturaId}/${fileName}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("candidaturas")
    .upload(filePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ ok: false, error: "Erro ao enviar arquivo." }, { status: 500 });
  }

  const { data: publicData } = supabase.storage.from("candidaturas").getPublicUrl(filePath);

  return NextResponse.json({
    ok: true,
    path: filePath,
    publicUrl: publicData.publicUrl,
  });
}
