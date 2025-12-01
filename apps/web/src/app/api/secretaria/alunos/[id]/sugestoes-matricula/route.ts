import { NextResponse } from "next/server";
import { getSugestoesMatricula } from "@/lib/secretaria/sugestoes";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const alunoId = id;
    const r = await getSugestoesMatricula(alunoId);
    if (!r.ok) return NextResponse.json({ ok: false, error: 'Sem vínculo ou dados' }, { status: 400 });
    return NextResponse.json({ ok: true, defaults: r.defaults, source: r.source });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
