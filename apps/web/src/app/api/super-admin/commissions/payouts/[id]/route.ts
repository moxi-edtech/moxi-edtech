import { NextRequest, NextResponse } from "next/server";

import { recordAuditServer } from "@/lib/audit";
import { requireSuperAdminRoute } from "@/lib/auth/requireSuperAdminRoute";

export const dynamic = "force-dynamic";

const ACTIONS = new Set(["approve", "reject", "mark_paid", "cancel"]);

type PayoutRow = {
  id: string;
  afiliado_codigo: string;
  status: string;
  total_kz: number | null;
  metadata: unknown;
};

type PayoutItemRow = {
  payout_id: string;
  commission_id: string;
};

type CommissionRow = {
  id: string;
  escola_id: string;
  status: string;
  approved_at: string | null;
  paid_at: string | null;
  metadata: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function transitionStatus(current: string, action: string) {
  if (action === "approve" && current === "requested") return "approved";
  if (action === "reject" && ["requested", "approved"].includes(current)) return "rejected";
  if (action === "mark_paid" && current === "approved") return "paid";
  if (action === "cancel" && current === "requested") return "cancelled";
  return null;
}

function actionToAudit(action: string) {
  switch (action) {
    case "approve":
      return "PARTNER_PAYOUT_APPROVED";
    case "reject":
      return "PARTNER_PAYOUT_REJECTED";
    case "mark_paid":
      return "PARTNER_PAYOUT_PAID";
    case "cancel":
      return "PARTNER_PAYOUT_CANCELLED";
    default:
      return "PARTNER_PAYOUT_UPDATED";
  }
}

function metadataForCommission(row: CommissionRow, payoutId: string, action: string, now: string, actorId: string, note: string) {
  const metadata = isRecord(row.metadata) ? { ...row.metadata } : {};
  const previousHistory = Array.isArray(metadata.payout_history) ? metadata.payout_history : [];
  const historyEntry = {
    payout_id: payoutId,
    action,
    at: now,
    actor_id: actorId,
    note: note || null,
  };

  if (action === "reject" || action === "cancel") {
    delete metadata.payout_id;
    delete metadata.payout_status;
    delete metadata.payout_requested_at;
    delete metadata.payout_approved_at;
    delete metadata.payout_paid_at;
  } else {
    metadata.payout_id = payoutId;
    metadata.payout_status = action === "approve" ? "approved" : "paid";
    if (action === "approve") metadata.payout_approved_at = now;
    if (action === "mark_paid") metadata.payout_paid_at = now;
  }

  metadata.payout_last_action = historyEntry;
  metadata.payout_history = [...previousHistory, historyEntry].slice(-20);
  return metadata;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminRoute();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim() : "";

    if (!ACTIONS.has(action)) {
      return NextResponse.json({ ok: false, error: "Ação inválida." }, { status: 400 });
    }
    if (["reject", "cancel"].includes(action) && note.length < 3) {
      return NextResponse.json({ ok: false, error: "Informe uma justificativa com pelo menos 3 caracteres." }, { status: 400 });
    }

    const supabase = auth.supabase;
    const { data: payoutData, error: payoutError } = await (supabase as any)
      .from("partner_commission_payouts")
      .select("id,afiliado_codigo,status,total_kz,metadata")
      .eq("id", id)
      .maybeSingle();

    if (payoutError) {
      return NextResponse.json({ ok: false, error: payoutError.message }, { status: 500 });
    }
    if (!payoutData) {
      return NextResponse.json({ ok: false, error: "Pedido de payout não encontrado." }, { status: 404 });
    }

    const payout = payoutData as PayoutRow;
    const nextStatus = transitionStatus(payout.status, action);
    if (!nextStatus) {
      return NextResponse.json(
        { ok: false, error: `Transição inválida: ${payout.status} -> ${action}.` },
        { status: 400 },
      );
    }

    const { data: itemData, error: itemError } = await (supabase as any)
      .from("partner_commission_payout_items")
      .select("payout_id,commission_id")
      .eq("payout_id", id);

    if (itemError) {
      return NextResponse.json({ ok: false, error: itemError.message }, { status: 500 });
    }

    const items = (itemData as PayoutItemRow[] | null) ?? [];
    const commissionIds = items.map((item) => item.commission_id);
    if (commissionIds.length === 0) {
      return NextResponse.json({ ok: false, error: "Pedido sem comissões associadas." }, { status: 400 });
    }

    const { data: commissionData, error: commissionError } = await (supabase as any)
      .from("partner_commissions")
      .select("id,escola_id,status,approved_at,paid_at,metadata")
      .in("id", commissionIds);

    if (commissionError) {
      return NextResponse.json({ ok: false, error: commissionError.message }, { status: 500 });
    }

    const commissions = (commissionData as CommissionRow[] | null) ?? [];
    if (commissions.length !== commissionIds.length) {
      return NextResponse.json({ ok: false, error: "Uma ou mais comissões do payout não foram encontradas." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const previousMetadata = isRecord(payout.metadata) ? payout.metadata : {};
    const previousHistory = Array.isArray(previousMetadata.admin_history) ? previousMetadata.admin_history : [];
    const historyEntry = {
      action,
      from_status: payout.status,
      to_status: nextStatus,
      note: note || null,
      at: now,
      actor_id: auth.user.id,
    };

    const payoutUpdates: Record<string, unknown> = {
      status: nextStatus,
      metadata: {
        ...previousMetadata,
        admin_last_action: historyEntry,
        admin_history: [...previousHistory, historyEntry].slice(-20),
      },
    };

    if (action === "approve") {
      payoutUpdates.approved_at = now;
    } else if (action === "mark_paid") {
      payoutUpdates.paid_at = now;
    } else if (action === "reject") {
      payoutUpdates.rejected_at = now;
    }

    const { data: updatedPayout, error: updatePayoutError } = await (supabase as any)
      .from("partner_commission_payouts")
      .update(payoutUpdates)
      .eq("id", id)
      .select("*")
      .single();

    if (updatePayoutError) {
      return NextResponse.json({ ok: false, error: updatePayoutError.message }, { status: 500 });
    }

    const commissionUpdates = commissions.map((commission) => {
      const updates: Record<string, unknown> = {
        metadata: metadataForCommission(commission, id, action, now, auth.user.id, note),
      };
      if (action === "mark_paid") {
        updates.status = "paid";
        updates.paid_at = now;
        updates.approved_at = commission.approved_at ?? now;
      }
      return (supabase as any).from("partner_commissions").update(updates).eq("id", commission.id);
    });

    const commissionResults = await Promise.all(commissionUpdates);
    const commissionUpdateError = commissionResults.find((result) => result.error)?.error;
    if (commissionUpdateError) {
      return NextResponse.json({ ok: false, error: commissionUpdateError.message }, { status: 500 });
    }

    await recordAuditServer({
      escolaId: commissions[0]?.escola_id ?? null,
      portal: "super_admin",
      acao: actionToAudit(action),
      entity: "partner_commission_payouts",
      entityId: id,
      details: {
        afiliado_codigo: payout.afiliado_codigo,
        total_kz: payout.total_kz,
        commission_count: commissionIds.length,
        from_status: payout.status,
        to_status: nextStatus,
        note: note || null,
        actor_id: auth.user.id,
      },
    });

    return NextResponse.json({ ok: true, payout: updatedPayout });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro interno ao atualizar payout." },
      { status: 500 },
    );
  }
}
