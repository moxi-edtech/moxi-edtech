import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerRole } from "@/lib/supabaseServerRole";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  escolaId: z.string().uuid(),
  candidaturaId: z.string().uuid(),
  path: z.string().trim().min(1).max(512),
});

function isSafeAdmissionPath(path: string, escolaId: string, candidaturaId: string) {
  if (path.includes("..") || path.startsWith("/") || path.includes("\\")) return false;
  return path.startsWith(`${escolaId}/${candidaturaId}/`);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  const { escolaId, candidaturaId, path } = parsed.data;
  if (!isSafeAdmissionPath(path, escolaId, candidaturaId)) {
    return NextResponse.json({ ok: false, error: "Caminho inválido." }, { status: 400 });
  }

  const supabase = supabaseServerRole();
  const { data, error } = await supabase.storage
    .from("candidaturas")
    .createSignedUrl(path, 60 * 30);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ ok: false, error: "Erro ao gerar acesso temporário." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, signedUrl: data.signedUrl });
}
