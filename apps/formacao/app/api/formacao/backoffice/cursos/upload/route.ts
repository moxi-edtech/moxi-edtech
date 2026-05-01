import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_admin",
  "formacao_secretaria",
  "super_admin",
  "global_admin",
];

export async function POST(request: Request) {
  try {
    const auth = await requireFormacaoRoles(allowedRoles);
    if (!auth.ok) return auth.response;
    const supabase = await supabaseServer();

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string; // 'thumbnail' | 'material'

    if (!file) {
      return NextResponse.json({ ok: false, error: "Arquivo não enviado" }, { status: 400 });
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${auth.escolaId}/${type || 'assets'}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from("formacao-assets")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload Error:", uploadError);
      return NextResponse.json({ ok: false, error: "Erro ao enviar arquivo" }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from("formacao-assets")
      .getPublicUrl(filePath);

    return NextResponse.json({ ok: true, url: publicUrl });
  } catch (err) {
    console.error("Unexpected Error:", err);
    return NextResponse.json({ ok: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}
