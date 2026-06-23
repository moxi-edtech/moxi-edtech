import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseRouteClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  step_code: z.string().trim().min(1),
  created_by: z.enum(["escola", "parceiro"]),
  member_id: z.string().uuid().optional(),
});

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]);

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

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
  if (type === "image/jpeg" || type === "image/jpg") return "jpg";
  if (type === "text/csv") return "csv";
  if (type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "xlsx";
  if (type === "application/vnd.ms-excel") return "xls";
  return "bin";
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json({ ok: false, error: "Token inválido" }, { status: 400 });
    }

    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
    }

    const parsed = BodySchema.safeParse({
      step_code: form.get("step_code"),
      created_by: form.get("created_by"),
      member_id: form.get("member_id") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos: " + parsed.error.issues[0]?.message }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Arquivo obrigatório." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ ok: false, error: "Formato de arquivo não suportado." }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ ok: false, error: "O arquivo é muito pesado. O limite é 10MB." }, { status: 400 });
    }

    const { step_code, created_by, member_id } = parsed.data;

    const supabase = await supabaseRouteClient();

    // Upload to Supabase Storage
    const fileName = `${slugFilePart(step_code)}_${Date.now()}.${extensionForType(file.type)}`;
    const filePath = `${token}/${step_code}/${fileName}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("onboarding")
      .upload(filePath, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ ok: false, error: "Erro ao enviar arquivo para o storage: " + uploadError.message }, { status: 500 });
    }

    const { data: rpcData, error: rpcError } = await (supabase.rpc as any)("create_onboarding_upload_by_token", {
      p_token: token,
      p_step_code: step_code,
      p_file_path: filePath,
      p_created_by: created_by,
      p_criado_por_membro_id: created_by === "parceiro" ? member_id ?? null : null,
    });

    if (rpcError) {
      await supabase.storage.from("onboarding").remove([filePath]).catch(() => null);
      return NextResponse.json({ ok: false, error: "Erro ao registrar upload: " + rpcError.message }, { status: 500 });
    }

    if (!rpcData?.ok) {
      await supabase.storage.from("onboarding").remove([filePath]).catch(() => null);
      return NextResponse.json({ ok: false, error: rpcData?.error || "Erro ao registrar upload." }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      upload: rpcData.upload,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro interno" }, { status: 500 });
  }
}
