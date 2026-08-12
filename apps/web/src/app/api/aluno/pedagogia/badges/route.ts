import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const { supabase, ctx } = await getAlunoContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  if (!ctx.escolaId || ctx.alunoIds.length === 0) return NextResponse.json({ ok: true, items: [] });
  const { data, error } = await (supabase as any).from("aluno_conquistas").select("id, aluno_id, awarded_at, evidence, conquistas_catalogo(id, codigo, titulo, descricao, icone)").eq("escola_id", ctx.escolaId).in("aluno_id", ctx.alunoIds).order("awarded_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const response = NextResponse.json({ ok: true, items: data ?? [] });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
