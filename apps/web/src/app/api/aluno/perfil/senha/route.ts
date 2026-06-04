import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";

export async function POST(req: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const body = await req.json();
    const { senha } = body;

    if (!senha || senha.length < 6) {
      return NextResponse.json({ ok: false, error: "A nova senha deve ter no mínimo 6 caracteres." }, { status: 400 });
    }

    const { error } = await supabase.auth.updateUser({
      password: senha
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
