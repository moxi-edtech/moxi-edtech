import { NextResponse } from "next/server";
import { z } from "zod";
import { getAlunoContext } from "@/lib/alunoContext";
import { AcademicYearContextError } from "@/lib/academic-year/context";
import { resolveBoletimMatricula } from "@/lib/aluno/resolveBoletimMatricula";
import { resolveSelectedStudentId } from "@/lib/portalAlunoAuth";

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
    const authorizedIds = ctx.alunoIds;
    if (studentId && !authorizedIds.includes(studentId)) return NextResponse.json({ ok: false, error: "Aluno não autorizado" }, { status: 403 });
    const alunoId = resolveSelectedStudentId({ selectedId: studentId ?? null, authorizedIds, fallbackId: ctx.alunoId });
    if (!alunoId) return NextResponse.json({ ok: false, error: "Educando não autorizado", next_action: { type: "contact_secretaria", label: "Regularizar acesso", href: "/aluno/avisos" } }, { status: 403 });

    if (codigo === "DOC_DECLARACAO_NOTAS") {
      return NextResponse.json({ ok: false, error: "Solicite a declaração oficial de notas à secretaria. A emissão depende da taxa própria liquidada." }, { status: 409 });
    }

    // Um boletim sem taxa configurada não pode criar um pedido gratuito
    // que mais tarde pareça um pagamento concluído.
    if (codigo === "DOC_BOLETIM_TRIMESTRAL") {
      const resolved = await resolveBoletimMatricula(supabase, {
        escolaId, alunoId, userId: ctx.userId, anoLetivoId, operation: "WRITE",
      });
      if (!resolved.matricula?.id) {
        return NextResponse.json({ ok: false, error: "Matrícula ativa não encontrada." }, { status: 409 });
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

    // Serviços cuja política exige pagamento não podem ser solicitados como
    // gratuitos por falta de tarifa. A mesma regra já se aplica ao boletim.
    if (codigo !== "DOC_BOLETIM_TRIMESTRAL") {
      const { data: configuredService, error: configuredServiceError } = await supabase
        .from("servicos_escola")
        .select("valor_base, exige_pagamento_antes_de_liberar")
        .eq("escola_id", escolaId)
        .eq("codigo", codigo)
        .eq("ativo", true)
        .maybeSingle();
      if (configuredServiceError) {
        return NextResponse.json({ ok: false, error: "Não foi possível consultar o serviço." }, { status: 503 });
      }
      if (configuredService?.exige_pagamento_antes_de_liberar && Number(configuredService.valor_base) <= 0) {
        return NextResponse.json({
          ok: false,
          error: "A escola ainda não definiu a taxa deste documento. Contacta a secretaria.",
        }, { status: 409 });
      }
    }

    // Boletim: contratação atómica com matrícula e session_id explícitos.
    // Outros documentos mantêm o contrato legado (sem alteração do motor financeiro).
    const resolved = codigo === "DOC_BOLETIM_TRIMESTRAL"
      ? await resolveBoletimMatricula(supabase, { escolaId, alunoId, userId: ctx.userId, anoLetivoId, operation: "WRITE" })
      : null;
    const { data, error } = codigo === "DOC_BOLETIM_TRIMESTRAL"
      ? await (supabase as unknown as { rpc: (name: string, args: Record<string, string>) => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> }).rpc("aluno_solicitar_boletim_matricula", {
          p_escola_id: escolaId, p_aluno_id: alunoId,
          p_matricula_id: resolved!.matricula!.id, p_session_id: resolved!.context.anoLetivoId,
        })
      : await supabase.rpc("aluno_solicitar_servico", {
          p_escola_id: escolaId, p_aluno_id: alunoId, p_servico_codigo: codigo,
        });

    if (error) {
      console.error("[SolicitarDoc] RPC Error:", error);
      return NextResponse.json({ ok: false, error: error.message, next_action: { type: "retry_request", label: "Tentar novamente", href: "/aluno/documentos" } }, { status: 409 });
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return NextResponse.json({ ok: false, error: "Resposta inválida ao solicitar o serviço." }, { status: 503 });
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
