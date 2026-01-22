import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> }
) {
  const { publicId } = await params;
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get("hash");

  if (!hash) {
    return NextResponse.json({ ok: false, error: "Hash ausente" }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ ok: false, error: "Configuração Supabase ausente." }, { status: 500 });
  }

  const admin = createClient<Database>(supabaseUrl, serviceRoleKey);

  const { data: doc, error } = await admin
    .from("documentos_emitidos")
    .select("id, public_id, escola_id, tipo, created_at, dados_snapshot")
    .eq("public_id", publicId)
    .maybeSingle();

  if (error || !doc) {
    return NextResponse.json({ ok: true, valid: false }, { status: 200 });
  }

  const snapshot = (doc as any).dados_snapshot || {};
  const valid = snapshot?.hash_validacao === hash;

  if (!valid) {
    return NextResponse.json({ ok: true, valid: false }, { status: 200 });
  }

  const { data: escola } = await admin
    .from("escolas")
    .select("nome")
    .eq("id", doc.escola_id)
    .maybeSingle();

  return NextResponse.json(
    {
      ok: true,
      valid: true,
      tipo: doc.tipo,
      escola: escola?.nome ?? "Escola",
      aluno: snapshot?.aluno_nome ?? "—",
      created_at: doc.created_at,
    },
    { status: 200 }
  );
}
