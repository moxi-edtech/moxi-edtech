import { NextResponse } from "next/server";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import {
  AcademicYearContextError,
  resolveAcademicYearContext,
} from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const aluno_id = searchParams.get("aluno_id");
    const matricula_id = searchParams.get("matricula_id");
    const ano_letivo_id = searchParams.get("ano_letivo_id");

    if (!aluno_id || !matricula_id) {
      return NextResponse.json(
        { ok: false, error: "aluno_id e matricula_id são obrigatórios" },
        { status: 400 },
      );
    }

    const supabase = await supabaseServerTyped<any>();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 },
      );
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json(
        { ok: false, error: "Escola não identificada" },
        { status: 403 },
      );
    }

    const authz = await requireRoleInSchool({
      supabase,
      escolaId,
      roles: [
        "secretaria",
        "secretaria_financeiro",
        "admin_financeiro",
        "admin",
        "admin_escola",
        "staff_admin",
      ],
    });
    if (authz.error) return authz.error;

    // ── Resolve academic year through the canonical context contract ──────
    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: user.id,
      requestedAcademicYearId: ano_letivo_id,
      operation: "READ",
    });
    const targetAnoLetivoId = academicContext.anoLetivoId;
    const targetAnoLetivoAno = Number(academicContext.anoLetivoLabel.slice(0, 4));

    // ── A origem pode ser do ano anterior; a matrícula destino só nasce após o pagamento ──
    const { data: matriculaOrigem } = await supabase
      .from("matriculas")
      .select("id, ano_letivo, status")
      .eq("escola_id", escolaId)
      .eq("id", matricula_id)
      .eq("aluno_id", aluno_id)
      .in("status", ["ativo", "ativa", "active", "pendente", "aprovado", "aprovada"])
      .maybeSingle();

    if (!matriculaOrigem) {
      return NextResponse.json(
        {
          ok: false,
          error: "Matrícula não encontrada ou inativa",
          code: "REMATRICULA_SOURCE_INVALID",
        },
        { status: 404 },
      );
    }

    // A rematrícula só é elegível quando ainda não existe matrícula do aluno
    // no ano destino. A matrícula de origem pode ser do ano anterior.
    const { data: matriculaDestino } = await supabase
      .from("matriculas")
      .select("id, turma_id")
      .eq("escola_id", escolaId)
      .eq("aluno_id", aluno_id)
      .eq("ano_letivo", targetAnoLetivoAno)
      .in("status", ["ativo", "ativa", "active", "pendente", "aprovado", "aprovada"])
      .limit(1)
      .maybeSingle();

    const { data: reclassificacao } = matriculaDestino
      ? await supabase
          .from("matricula_reclassificacoes")
          .select("id, tipo, status, destino_turma_id")
          .eq("escola_id", escolaId)
          .eq("matricula_id", matriculaDestino.id)
          .eq("status", "aguardando_destino")
          .maybeSingle()
      : { data: null };

    const { data: mensalidadesFinanceiras } = await supabase
      .from("mensalidades")
      .select("status, valor_previsto, valor, valor_pago_total")
      .eq("escola_id", escolaId)
      .eq("aluno_id", aluno_id)
      .eq("matricula_id", matricula_id);
    const mensalidadesEmAberto = (mensalidadesFinanceiras ?? []).filter(
      (mensalidade: any) => !["pago", "isento", "cancelado"].includes(String(mensalidade.status).toLowerCase()),
    );
    const dividaTotal = mensalidadesEmAberto.reduce(
      (total: number, mensalidade: any) => total + Math.max(
        Number(mensalidade.valor_previsto ?? mensalidade.valor ?? 0) - Number(mensalidade.valor_pago_total ?? 0),
        0,
      ),
      0,
    );

    // ── Check service config ──────────────────────────────────────────────
    const { data: service } = await supabase
      .from("servicos_escola")
      .select("id, codigo, nome, valor_base, ativo")
      .eq("escola_id", escolaId)
      .eq("codigo", "SERV_REMATRICULA")
      .maybeSingle();

    // ── Check existing pedido ─────────────────────────────────────────────
    const { data: pedidosExistentes } = await supabase
      .from("servico_pedidos")
      .select("id, status, created_at, reason_code, valor_cobrado, contexto")
      .eq("escola_id", escolaId)
      .eq("aluno_id", aluno_id)
      .eq("servico_codigo", "SERV_REMATRICULA")
      .in("status", ["pending_payment", "granted"])
      .order("created_at", { ascending: false });
    const pedidoExistente = (pedidosExistentes ?? []).find(
      (pedido: any) => pedido.contexto?.ano_letivo_id === targetAnoLetivoId,
    ) ?? (pedidosExistentes ?? []).find(
      (pedido: any) => !pedido.contexto || Object.keys(pedido.contexto).length === 0,
    );
    const pedidoLegado = Boolean(
      pedidoExistente && (!pedidoExistente.contexto || Object.keys(pedidoExistente.contexto).length === 0),
    );

    // ── Check comprovante for granted pedido ──────────────────────────────
    let comprovanteData: { docId: string; publicId: string; printUrl: string } | null = null;
    if (pedidoExistente?.status === "granted") {
      const { data: comprovanteDoc } = await supabase
        .from("documentos_emitidos")
        .select("id, public_id")
        .eq("escola_id", escolaId)
        .eq("tipo", "comprovante_matricula")
        .contains("dados_snapshot", { matricula_id: pedidoExistente.contexto?.matricula_destino_id ?? matricula_id })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (comprovanteDoc) {
        comprovanteData = {
          docId: comprovanteDoc.id,
          publicId: comprovanteDoc.public_id,
          printUrl: `/secretaria/documentos/${comprovanteDoc.id}/comprovante-matricula/print`,
        };
      }
    }

    // ── Determine status ──────────────────────────────────────────────────
    let status = "READY";
    if (pedidoExistente?.status === "granted") {
      status = "ALREADY_COMPLETED";
    } else if (pedidoExistente?.status === "pending_payment") {
      status = pedidoLegado
        ? "LEGACY_REVIEW_REQUIRED"
        : pedidoExistente.reason_code === "REMATRICULA_RECONCILIATION_REQUIRED"
          ? "RECONCILIATION_REQUIRED"
        : "PAYMENT_IN_PROGRESS";
    } else if (dividaTotal > 0) {
      status = "DEBT_BLOCKED";
    } else if (matriculaDestino) {
      status = reclassificacao ? "FINALIST_PENDING" : "RECONFIRMATION_REQUIRED";
    } else if (!service || !service.ativo || Number(service.valor_base) <= 0) {
      status = "PRICE_NOT_CONFIGURED";
    }

    // ── Extract turma_id from granted pedido contexto ─────────────────────
    const pedidoTurmaId =
      pedidoExistente?.contexto?.destino_turma_id ?? undefined;

    return NextResponse.json({
      ok: true,
      status,
      service: service
        ? {
            id: service.id,
            nome: service.nome,
            valor_base: Number(service.valor_base),
          }
        : null,
      debt: {
        total: dividaTotal,
        count: mensalidadesEmAberto.filter((mensalidade: any) =>
          Number(mensalidade.valor_previsto ?? mensalidade.valor ?? 0) - Number(mensalidade.valor_pago_total ?? 0) > 0,
        ).length,
      },
      pedido: pedidoExistente
        ? {
            id: pedidoExistente.id,
            status: pedidoExistente.status,
            created_at: pedidoExistente.created_at,
            turma_id: pedidoTurmaId,
            valor_cobrado: pedidoExistente.valor_cobrado
              ? Number(pedidoExistente.valor_cobrado)
              : undefined,
          }
        : null,
      reconciliation: pedidoLegado
        ? {
            can_cancel: pedidoExistente?.status === "pending_payment",
            reason: "Pedido incompleto sem ano letivo identificado",
          }
        : null,
      comprovante: comprovanteData,
      ano_letivo: {
        id: targetAnoLetivoId,
        ano: targetAnoLetivoAno,
        label: academicContext.anoLetivoLabel,
      },
      destino_turma_id: matriculaDestino?.turma_id ?? null,
      reclassificacao: reclassificacao
        ? {
            id: reclassificacao.id,
            tipo: reclassificacao.tipo,
            status: reclassificacao.status,
            destino_turma_id: reclassificacao.destino_turma_id,
          }
        : null,
      context: academicContext,
    });
  } catch (error) {
    if (error instanceof AcademicYearContextError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[REMATRICULA-STATUS]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
