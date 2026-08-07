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

    // ── Verify active matrícula in academic year ──────────────────────────
    const { data: matricula } = await supabase
      .from("matriculas")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("id", matricula_id)
      .eq("aluno_id", aluno_id)
      .eq("session_id", targetAnoLetivoId)
      .in("status", ["ativo", "ativa", "active"])
      .maybeSingle();

    if (!matricula) {
      return NextResponse.json(
        {
          ok: false,
          error: "Matrícula não encontrada ou inativa",
          code: "REMATRICULA_SOURCE_INVALID",
        },
        { status: 404 },
      );
    }

    // ── Check service config ──────────────────────────────────────────────
    const { data: service } = await supabase
      .from("servicos_escola")
      .select("id, codigo, nome, valor_base, ativo")
      .eq("escola_id", escolaId)
      .eq("codigo", "SERV_REMATRICULA")
      .maybeSingle();

    // ── Check debts ───────────────────────────────────────────────────────
    const { data: debts } = await supabase
      .from("mensalidades")
      .select("valor_previsto, valor_pago_total")
      .eq("escola_id", escolaId)
      .eq("matricula_id", matricula_id)
      .in("status", ["pendente", "pago_parcial"]);

    const outstanding = (debts ?? []).reduce((total: number, debt: any) => {
      const remaining =
        Number(debt.valor_previsto ?? 0) - Number(debt.valor_pago_total ?? 0);
      return total + Math.max(0, remaining);
    }, 0);

    // ── Check existing pedido ─────────────────────────────────────────────
    const { data: pedidoExistente } = await supabase
      .from("servico_pedidos")
      .select("id, status, created_at, reason_code, valor_cobrado, contexto")
      .eq("escola_id", escolaId)
      .eq("aluno_id", aluno_id)
      .eq("servico_codigo", "SERV_REMATRICULA")
      .contains("contexto", { ano_letivo_id: targetAnoLetivoId })
      .in("status", ["pending_payment", "granted"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // ── Check comprovante for granted pedido ──────────────────────────────
    let comprovanteData: { docId: string; publicId: string; printUrl: string } | null = null;
    if (pedidoExistente?.status === "granted") {
      const { data: comprovanteDoc } = await supabase
        .from("documentos_emitidos")
        .select("id, public_id")
        .eq("escola_id", escolaId)
        .eq("tipo", "comprovante_matricula")
        .contains("dados_snapshot", { matricula_id })
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
    if (!service || !service.ativo || Number(service.valor_base) <= 0) {
      status = "PRICE_NOT_CONFIGURED";
    } else if (outstanding > 0) {
      status = "DEBT_BLOCKED";
    } else if (pedidoExistente?.status === "granted") {
      status = "ALREADY_COMPLETED";
    } else if (pedidoExistente?.status === "pending_payment") {
      if (
        pedidoExistente.reason_code ===
        "REMATRICULA_RECONCILIATION_REQUIRED"
      ) {
        status = "RECONCILIATION_REQUIRED";
      } else {
        status = "PAYMENT_IN_PROGRESS";
      }
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
      debt:
        outstanding > 0
          ? { total: outstanding, count: (debts ?? []).length }
          : null,
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
      comprovante: comprovanteData,
      ano_letivo: {
        id: targetAnoLetivoId,
        ano: targetAnoLetivoAno,
        label: academicContext.anoLetivoLabel,
      },
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
