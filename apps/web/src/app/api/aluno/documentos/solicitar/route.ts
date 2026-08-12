import { NextResponse } from "next/server";
import { z } from "zod";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveAuthorizedStudentIds, resolveSelectedStudentId } from "@/lib/portalAlunoAuth";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  codigo: z.string(),
  studentId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx || !ctx.escolaId) {
      return NextResponse.json({ ok: false, error: "Contexto não encontrado", next_action: { type: "contact_secretaria", label: "Contactar a secretaria", href: "/aluno/avisos" } }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 });
    }

    const { codigo, studentId } = parsed.data;
    const { escolaId } = ctx;
    const authorizedIds = await resolveAuthorizedStudentIds({ supabase, userId: ctx.userId, escolaId, userEmail: (await supabase.auth.getUser()).data.user?.email });
    const alunoId = resolveSelectedStudentId({ selectedId: studentId ?? null, authorizedIds, fallbackId: ctx.alunoId });
    if (!alunoId) return NextResponse.json({ ok: false, error: "Educando não autorizado", next_action: { type: "contact_secretaria", label: "Regularizar acesso", href: "/aluno/avisos" } }, { status: 403 });

    // Chamar RPC de solicitação de serviço
    const { data, error } = await (supabase as any).rpc("aluno_solicitar_servico", {
      p_escola_id: escolaId,
      p_aluno_id: alunoId,
      p_servico_codigo: codigo,
    });

    if (error) {
      console.error("[SolicitarDoc] RPC Error:", error);
      return NextResponse.json({ ok: false, error: error.message, next_action: { type: "retry_request", label: "Tentar novamente", href: "/aluno/documentos" } }, { status: 409 });
    }

    return NextResponse.json({ ...data, next_action: data?.status === "pending_payment" ? { type: "pay_service", label: "Pagar agora", href: "/aluno/documentos" } : data?.status === "granted" ? { type: "download", label: "Descarregar", href: "/aluno/documentos" } : { type: "track_request", label: "Acompanhar pedido", href: "/aluno/documentos" } });
  } catch (error: any) {
    console.error("[SolicitarDoc] Server Error:", error);
    return NextResponse.json({ ok: false, error: "Falha ao processar solicitação", next_action: { type: "retry_request", label: "Tentar novamente", href: "/aluno/documentos" } }, { status: 500 });
  }
}
