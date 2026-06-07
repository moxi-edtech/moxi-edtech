import { NextResponse } from "next/server";
import { z } from "zod";
import { getAlunoContext } from "@/lib/alunoContext";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  codigo: z.string(),
});

export async function POST(req: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx || !ctx.alunoId || !ctx.escolaId) {
      return NextResponse.json({ ok: false, error: "Contexto não encontrado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 });
    }

    const { codigo } = parsed.data;
    const { escolaId, alunoId } = ctx;

    // Chamar RPC de solicitação de serviço
    const { data, error } = await (supabase as any).rpc("aluno_solicitar_servico", {
      p_escola_id: escolaId,
      p_aluno_id: alunoId,
      p_servico_codigo: codigo,
    });

    if (error) {
      console.error("[SolicitarDoc] RPC Error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("[SolicitarDoc] Server Error:", error);
    return NextResponse.json({ ok: false, error: "Falha ao processar solicitação" }, { status: 500 });
  }
}
