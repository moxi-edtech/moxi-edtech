import { NextResponse } from "next/server";
import { requireRoleInSchool } from "@/lib/authz";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import {
  AcademicYearContextError,
  resolveAcademicYearContext,
} from "@/lib/academic-year/context";
import { normalizeAnoLetivo } from "@/lib/financeiro/tabela-preco";
import { resolveValorConfirmacao } from "@/lib/financeiro/resolve-confirmacao";
import { isMensalidadeVencida, todayInLuanda } from "@/lib/financeiro/mensalidade-vencida";
import { resolveRematriculaWindow } from "@/lib/secretaria/rematricula-window";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const aluno_id = searchParams.get("aluno_id");
    const matricula_id = searchParams.get("matricula_id");
    const ano_letivo_id = searchParams.get("ano_letivo_id");
    const destino_turma_id = searchParams.get("destino_turma_id");

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
    const rematriculaWindow = await resolveRematriculaWindow(
      supabase,
      escolaId,
      targetAnoLetivoAno,
    );

    if (!rematriculaWindow.open) {
      return NextResponse.json({
        ok: true,
        status: "WINDOW_CLOSED",
        service: null,
        debt: { total: 0, count: 0 },
        pedido: null,
        comprovante: null,
        ano_letivo: {
          id: targetAnoLetivoId,
          ano: targetAnoLetivoAno,
          label: academicContext.anoLetivoLabel,
        },
        destino_turma_id: null,
        reclassificacao: null,
        reconciliation: null,
        window: {
          configured: rematriculaWindow.configured,
          open: false,
          data_inicio: rematriculaWindow.window?.data_inicio ?? null,
          data_fim: rematriculaWindow.window?.data_fim ?? null,
        },
        context: academicContext,
      });
    }

    // ── A origem pode ser do ano anterior; a matrícula destino só nasce após o pagamento ──
    let { data: matriculaOrigem } = await supabase
      .from("matriculas")
      .select("id, ano_letivo, status, turma_id")
      .eq("escola_id", escolaId)
      .eq("id", matricula_id)
      .eq("aluno_id", aluno_id)
      .in("status", ["ativo", "ativa", "active", "pendente", "aprovado", "aprovada", "transferido"])
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
    if (Number(matriculaOrigem.ano_letivo ?? 0) >= targetAnoLetivoAno) {
      const { data: matriculaAnterior } = await supabase
        .from("matriculas")
        .select("id, ano_letivo, status, turma_id")
        .eq("escola_id", escolaId)
        .eq("aluno_id", aluno_id)
        .lt("ano_letivo", targetAnoLetivoAno)
        .in("status", ["ativo", "ativa", "active", "pendente", "aprovado", "aprovada", "transferido"])
        .order("ano_letivo", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!matriculaAnterior) {
        return NextResponse.json({ ok: true, status: "CHECKING", service: null, debt: { total: 0, count: 0 }, pedido: null, comprovante: null, ano_letivo: { id: targetAnoLetivoId, ano: targetAnoLetivoAno, label: academicContext.anoLetivoLabel }, destino_turma_id: null, reclassificacao: null, reconciliation: null, context: academicContext });
      }
      matriculaOrigem = matriculaAnterior;
    }

    // A matrícula destino pode existir como reserva pendente criada pela
    // promoção. Ela só deixa de exigir este fluxo quando a taxa/isenção foi
    // confirmada e o pedido de rematrícula está concedido.
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
      .select("status, valor_previsto, valor, valor_pago_total, data_vencimento, mes_referencia, ano_referencia")
      .eq("escola_id", escolaId)
      .eq("aluno_id", aluno_id)
      .eq("matricula_id", matriculaOrigem.id);
    const today = todayInLuanda();
    const mensalidadesEmAberto = (mensalidadesFinanceiras ?? []).filter(
      (mensalidade: any) =>
        !["pago", "isento", "cancelado"].includes(String(mensalidade.status).toLowerCase()) &&
        isMensalidadeVencida(mensalidade, today),
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

    const targetTurmaId = destino_turma_id ?? reclassificacao?.destino_turma_id ?? matriculaDestino?.turma_id ?? matriculaOrigem?.turma_id ?? null;
    const { data: targetTurma } = targetTurmaId
      ? await supabase.from("turmas").select("curso_id, classe_id").eq("escola_id", escolaId).eq("id", targetTurmaId).maybeSingle()
      : { data: null };
    const targetPricing = await resolveValorConfirmacao(supabase, {
      escolaId,
      anoLetivo: normalizeAnoLetivo(academicContext.anoLetivoLabel),
      cursoId: targetTurma?.curso_id,
      classeId: targetTurma?.classe_id,
      valorGlobal: service?.valor_base,
    });

    // ── Check existing pedido ─────────────────────────────────────────────
    const { data: pedidosExistentes } = await supabase
      .from("servico_pedidos")
      .select("id, status, created_at, reason_code, reason_detail, valor_cobrado, contexto")
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
    } else if (!service || !service.ativo || (targetPricing.valor <= 0 && targetPricing.origem !== "classe")) {
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
            valor_base: targetPricing.valor,
            pricing_origin: targetPricing.origem,
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
        : pedidoExistente?.reason_code === "REMATRICULA_RECONCILIATION_REQUIRED"
          ? {
              can_cancel: true,
              reason: pedidoExistente.reason_detail ?? "A matrícula precisa de reconciliação",
            }
        : null,
      window: {
        configured: rematriculaWindow.configured,
        open: rematriculaWindow.open,
        data_inicio: rematriculaWindow.window?.data_inicio ?? null,
        data_fim: rematriculaWindow.window?.data_fim ?? null,
      },
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
