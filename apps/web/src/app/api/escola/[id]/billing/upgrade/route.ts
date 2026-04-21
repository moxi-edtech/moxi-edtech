import { NextRequest, NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { PLAN_VALUES, type PlanTier } from "@/config/plans";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PLAN_INDEX: Record<PlanTier, number> = {
  essencial: 0,
  profissional: 1,
  premium: 2,
};

const PRICE_TABLE: Record<PlanTier, { mensal: number; anual: number }> = {
  essencial: { mensal: 60000, anual: 600000 },
  profissional: { mensal: 120000, anual: 1200000 },
  premium: { mensal: 0, anual: 0 },
};

type BillingPayload = {
  targetPlan?: PlanTier;
  targetCycle?: "mensal" | "anual";
};

function normalizeCycle(value: unknown): "mensal" | "anual" {
  return value === "anual" ? "anual" : "mensal";
}

function isPlanTier(value: unknown): value is PlanTier {
  return typeof value === "string" && PLAN_VALUES.includes(value as PlanTier);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await supabaseServerTyped<Database>();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }

    const resolvedEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);
    if (!resolvedEscolaId) {
      return NextResponse.json({ ok: false, error: "Acesso negado a esta escola." }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as BillingPayload;

    const { data: assinatura, error: assinaturaError } = await supabase
      .from("assinaturas")
      .select("id, escola_id, plano, ciclo, status, data_renovacao, valor_kz, metodo_pagamento")
      .eq("escola_id", resolvedEscolaId)
      .maybeSingle();

    if (assinaturaError) throw assinaturaError;

    if (!assinatura) {
      return NextResponse.json({ ok: false, error: "Assinatura não encontrada." }, { status: 404 });
    }

    if (assinatura.status !== "activa") {
      return NextResponse.json(
        { ok: false, error: "Upgrade permitido apenas durante ciclo activo." },
        { status: 409 }
      );
    }

    const now = new Date();
    const renewalDate = new Date(assinatura.data_renovacao);
    const cycleIsActive = now < renewalDate;

    if (!cycleIsActive) {
      return NextResponse.json(
        { ok: false, error: "Ciclo inactivo. Aguarde renovação para alterar o plano." },
        { status: 409 }
      );
    }

    const nextPlan: PlanTier = isPlanTier(body.targetPlan) ? body.targetPlan : assinatura.plano;
    const currentCycle = normalizeCycle(assinatura.ciclo);
    const nextCycle: "mensal" | "anual" = body.targetCycle === "anual" ? "anual" : currentCycle;

    const currentPlanIndex = PLAN_INDEX[assinatura.plano as PlanTier];
    const targetPlanIndex = PLAN_INDEX[nextPlan];

    if (targetPlanIndex < currentPlanIndex) {
      return NextResponse.json(
        { ok: false, error: "Downgrade no meio do ciclo não é permitido." },
        { status: 409 }
      );
    }

    const updatedValue = PRICE_TABLE[nextPlan][nextCycle];

    const { error: updateError } = await supabase
      .from("assinaturas")
      .update({
        plano: nextPlan,
        ciclo: nextCycle,
        valor_kz: updatedValue,
      })
      .eq("id", assinatura.id)
      .eq("escola_id", resolvedEscolaId);

    if (updateError) throw updateError;

    const actionLabel = targetPlanIndex > currentPlanIndex ? "upgrade" : "mudança de ciclo";

    return NextResponse.json({
      ok: true,
      action: actionLabel,
      message:
        assinatura.metodo_pagamento === "stripe" || assinatura.metodo_pagamento === "cartao"
          ? "Alteração registada. O fluxo Stripe será priorizado para cobrança automática."
          : "Alteração registada. Continue com upload de comprovativo para pagamentos por transferência.",
      data: {
        assinaturaId: assinatura.id,
        targetPlan: nextPlan,
        targetCycle: nextCycle,
        valor_kz: updatedValue,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao iniciar upgrade.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
