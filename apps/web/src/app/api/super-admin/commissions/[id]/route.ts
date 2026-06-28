import { NextRequest, NextResponse } from "next/server";

import { requireSuperAdminRoute } from "@/lib/auth/requireSuperAdminRoute";
import { recordAuditServer } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ACTIONS = new Set(["approve", "block", "mark_paid", "cancel", "reopen"]);

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

function actionToAudit(action: string) {
  switch (action) {
    case "approve":
      return "PARTNER_COMMISSION_APPROVED";
    case "block":
      return "PARTNER_COMMISSION_BLOCKED";
    case "mark_paid":
      return "PARTNER_COMMISSION_PAID";
    case "cancel":
      return "PARTNER_COMMISSION_CANCELLED";
    case "reopen":
      return "PARTNER_COMMISSION_REOPENED";
    default:
      return "PARTNER_COMMISSION_UPDATED";
  }
}

function transitionStatus(current: string, action: string) {
  if (action === "approve" && ["pending", "blocked"].includes(current)) return "approved";
  if (action === "block" && ["pending", "approved"].includes(current)) return "blocked";
  if (action === "mark_paid" && current === "approved") return "paid";
  if (action === "cancel" && ["pending", "approved", "blocked"].includes(current)) return "cancelled";
  if (action === "reopen" && ["blocked", "cancelled"].includes(current)) return "pending";
  return null;
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

    if (["block", "cancel"].includes(action) && note.length < 3) {
      return NextResponse.json({ ok: false, error: "Informe uma justificativa com pelo menos 3 caracteres." }, { status: 400 });
    }

    const supabase = auth.supabase;
    const { data, error } = await (supabase as any)
      .from("partner_commissions")
      .select("id,escola_id,status,approved_at,paid_at,metadata")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ ok: false, error: "Comissão não encontrada." }, { status: 404 });
    }

    const row = data as CommissionRow;
    const nextStatus = transitionStatus(row.status, action);
    if (!nextStatus) {
      return NextResponse.json(
        { ok: false, error: `Transição inválida: ${row.status} -> ${action}.` },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const previousMetadata = isRecord(row.metadata) ? row.metadata : {};
    const previousHistory = Array.isArray(previousMetadata.admin_history) ? previousMetadata.admin_history : [];
    const historyEntry = {
      action,
      from_status: row.status,
      to_status: nextStatus,
      note: note || null,
      at: now,
      actor_id: auth.user.id,
    };

    const updates: Record<string, unknown> = {
      status: nextStatus,
      metadata: {
        ...previousMetadata,
        admin_last_action: historyEntry,
        admin_history: [...previousHistory, historyEntry].slice(-20),
      },
    };

    if (action === "approve") {
      updates.approved_at = row.approved_at ?? now;
    }
    if (action === "mark_paid") {
      updates.paid_at = now;
      updates.approved_at = row.approved_at ?? now;
    }

    const { data: updated, error: updateError } = await (supabase as any)
      .from("partner_commissions")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    await recordAuditServer({
      escolaId: row.escola_id,
      portal: "super_admin",
      acao: actionToAudit(action),
      entity: "partner_commissions",
      entityId: id,
      details: {
        from_status: row.status,
        to_status: nextStatus,
        note: note || null,
        actor_id: auth.user.id,
      },
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro interno ao atualizar comissão." },
      { status: 500 },
    );
  }
}
