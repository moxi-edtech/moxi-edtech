import { NextResponse } from "next/server";

export async function POST(req: Request, context: { params: { id: string } }) {
  const { id: escolaId } = context.params;
  try {
    // TODO: limpar estrutura dessa sessão

    return NextResponse.json({
      ok: true,
      cleared: ["classes", "turmas", "disciplinas", "cursos"]
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
