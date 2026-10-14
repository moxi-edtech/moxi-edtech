import { NextResponse } from "next/server";
import { z } from "zod";
import { getAlunoContext } from "@/lib/alunoContext";
import { AcademicYearContextError } from "@/lib/academic-year/context";
import { resolveBoletimMatricula } from "@/lib/aluno/resolveBoletimMatricula";
import { resolveAuthorizedStudentIds, resolveSelectedStudentId } from "@/lib/portalAlunoAuth";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  codigo: z.string(),
  studentId: z.string().uuid().optional(),
  ano_letivo_id: z.string().uuid().optional(),
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

    const { codigo, studentId, ano_letivo_id: anoLetivoId } = parsed.data;
    const { escolaId } = ctx;
    const authorizedIds = await resolveAuthorizedStudentIds({ supabase, userId: ctx.userId, escolaId, userEmail: (await supabase.auth.getUser()).data.user?.email });
    if (studentId && !authorizedIds.includes(studentId)) return NextResponse.json({ ok: false, error: "Aluno não autorizado" }, { status: 403 });
    const alunoId = resolveSelectedStudentId({ selectedId: studentId ?? null, authorizedIds, fallbackId: ctx.alunoId });
    if (!alunoId) return NextResponse.json({ ok: false, error: "Educando não autorizado", next_action: { type: "contact_secretaria", label: "Regularizar acesso", href: "/aluno/avisos" } }, { status: 403 });

    // Um boletim sem taxa configurada não pode criar um pedido gratuito
    // que mais tarde pareça um pagamento concluído.
    if (codigo === "DOC_BOLETIM_TRIMESTRAL") {
      // A RPC histórica recebe apenas aluno/código e escolhe a matrícula activa mais
      // recente. Até existir escrita com matrícula explícita no banco, bloquear
      // contextos ambíguos em vez de emitir cobrança para o ano errado.
      const { matricula } = await resolveBoletimMatricula(supabase, {
        escolaId, alunoId, userId: ctx.userId, anoLetivoId, operation: "WRITE",
      });
      if (!matricula?.id) {
        return NextResponse.json({ ok: false, error: "Matrícula não encontrada para este ano letivo." }, { status: 409 });
      }
      const { data: active, error: activeError } = await supabase.from("matriculas")
        .select("id").eq("escola_id", escolaId).eq("aluno_id", alunoId)
        .in("status", ["ativa", "ativo"]).limit(2);
      if (activeError) return NextResponse.json({ ok: false, error: "Não foi possível verificar a matrícula." }, { status: 503 });
      if (active?.length !== 1 || active[0].id !== matricula.id) {
        return NextResponse.json({ ok: false, error: "Existem matrículas activas em conflito. A secretaria deve regularizar o ano letivo antes de cobrar." }, { status: 409 });
      }
      const { data: conflictingOrder, error: pendingError } = await supabase.from("servico_pedidos")
        .select("id").eq("escola_id", escolaId).eq("aluno_id", alunoId)
        .eq("servico_codigo", codigo).in("status", ["pending_payment", "blocked"])
        .neq("matricula_id", matricula.id).limit(1);
      if (pendingError) return NextResponse.json({ ok: false, error: "Não foi possível verificar pedidos anteriores." }, { status: 503 });
      if (conflictingOrder?.length) {
        return NextResponse.json({ ok: false, error: "Há um pedido de boletim em outra matrícula. Contacte a secretaria; não efectue novo pagamento." }, { status: 409 });
      }
      const { data: servico, error: servicoError } = await supabase
        .from("servicos_escola")
        .select("valor_base")
        .eq("escola_id", escolaId)
        .eq("codigo", codigo)
        .eq("ativo", true)
        .maybeSingle();
      if (servicoError) return NextResponse.json({ ok: false, error: "Não foi possível consultar a taxa do boletim." }, { status: 503 });
      if (!servico || Number(servico.valor_base) <= 0) {
        return NextResponse.json({ ok: false, error: "A secretaria precisa configurar a taxa do boletim antes de solicitar o pagamento." }, { status: 409 });
      }
    }

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

    // A RPC antiga não recebe session_id. Conferimos o resultado antes de
    // expor qualquer cobrança ao aluno (preflight acima impede ambiguidade).
    if (codigo === "DOC_BOLETIM_TRIMESTRAL" && typeof data?.pedido_id === "string") {
      const { matricula } = await resolveBoletimMatricula(supabase, {
        escolaId, alunoId, userId: ctx.userId, anoLetivoId, operation: "WRITE",
      });
      const { data: pedido, error: pedidoError } = await supabase.from("servico_pedidos")
        .select("matricula_id").eq("id", data.pedido_id).eq("escola_id", escolaId).eq("aluno_id", alunoId).maybeSingle();
      if (pedidoError || pedido?.matricula_id !== matricula?.id) {
        return NextResponse.json({ ok: false, error: "A solicitação não corresponde à matrícula seleccionada. Não efectue pagamento e contacte a secretaria." }, { status: 409 });
      }
    }
    return NextResponse.json({ ...data, next_action: data?.status === "pending_payment" ? { type: "pay_service", label: "Pagar agora", href: "/aluno/documentos" } : data?.status === "granted" ? { type: "download", label: "Descarregar", href: "/aluno/documentos" } : { type: "track_request", label: "Acompanhar pedido", href: "/aluno/documentos" } });
  } catch (error: unknown) {
    if (error instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[SolicitarDoc] Server Error:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ ok: false, error: "Falha ao processar solicitação", next_action: { type: "retry_request", label: "Tentar novamente", href: "/aluno/documentos" } }, { status: 500 });
  }
}
