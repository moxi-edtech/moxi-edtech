import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";

export async function GET() {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const { escolaId, alunoId } = ctx;

    if (!escolaId || !alunoId) {
      return NextResponse.json({ ok: false, error: "Contexto incompleto" }, { status: 400 });
    }

    const { data: aluno, error } = await supabase
      .from("alunos")
      .select("nome, email, telefone, responsavel_contato, telefone_responsavel, encarregado_telefone, endereco")
      .eq("id", alunoId)
      .eq("escola_id", escolaId)
      .single();

    if (error || !aluno) throw error || new Error("Aluno não encontrado");

    return NextResponse.json({ ok: true, dados: aluno });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const { escolaId, alunoId } = ctx;

    if (!escolaId || !alunoId) {
      return NextResponse.json({ ok: false, error: "Contexto incompleto" }, { status: 400 });
    }

    const body = await req.json();
    const { email, telefone, endereco } = body;

    // Apenas permitimos atualização de dados de contacto não críticos
    const updateData: Record<string, string | null> = {};
    if (email !== undefined) updateData.email = email || null;
    if (telefone !== undefined) updateData.telefone = telefone || null;
    if (endereco !== undefined) updateData.endereco = endereco || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ ok: false, error: "Nenhum dado para atualizar" }, { status: 400 });
    }

    const { error } = await supabase
      .from("alunos")
      .update(updateData)
      .eq("id", alunoId)
      .eq("escola_id", escolaId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
