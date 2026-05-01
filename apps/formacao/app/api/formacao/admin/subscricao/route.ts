import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireFormacaoRoles } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

const allowedRoles = ["formacao_admin", "formacao_financeiro", "super_admin", "global_admin"];

function getAdminClient() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) throw new Error("Supabase admin não configurado.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function mapPlanToLabel(plan: string | null | undefined) {
  if (plan === "pro") return "Corporativo";
  if (plan === "enterprise") return "Enterprise";
  return "Essencial";
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizePaymentInstructions(row: Record<string, unknown> | null) {
  return {
    banco: cleanText(row?.banco),
    titular_conta: cleanText(row?.titular_conta),
    iban: cleanText(row?.iban),
    numero_conta: cleanText(row?.numero_conta),
    kwik_chave: cleanText(row?.kwik_chave),
    email_comercial: cleanText(row?.email_comercial),
    telefone_comercial: cleanText(row?.telefone_comercial),
    whatsapp_comercial: cleanText(row?.whatsapp_comercial),
    link_pagamento: cleanText(row?.link_pagamento),
  };
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function monthDiff(from: Date, to: Date) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildMesesAPagar({
  assinatura,
  centro,
  pagamentos,
  valorPadrao,
}: {
  assinatura: Record<string, unknown> | null;
  centro: Record<string, unknown>;
  pagamentos: Array<Record<string, unknown>>;
  valorPadrao: number;
}) {
  const today = new Date();
  const renewalRaw = cleanText(assinatura?.data_renovacao || centro.trial_ends_at);
  const baseDate = renewalRaw ? new Date(renewalRaw) : today;
  const start = monthStart(Number.isNaN(baseDate.getTime()) ? today : baseDate);
  const current = monthStart(today);
  const monthsCount =
    assinatura?.status === "activa" && start.getTime() > current.getTime()
      ? 1
      : Math.max(1, Math.min(12, monthDiff(start, current) + 1));

  return Array.from({ length: monthsCount }, (_, index) => {
    const periodStart = addMonths(start, index);
    const periodEnd = monthEnd(periodStart);
    const periodStartIso = isoDate(periodStart);
    const periodEndIso = isoDate(periodEnd);
    const matchingPayment = pagamentos.find((payment) => {
      const paymentStart = cleanText(payment.periodo_inicio);
      return paymentStart.slice(0, 7) === periodStartIso.slice(0, 7);
    });

    const paymentStatus = cleanText(matchingPayment?.status);
    const status = paymentStatus === "confirmado"
      ? "pago"
      : paymentStatus === "pendente"
        ? "pendente"
        : periodStart.getTime() > current.getTime()
          ? "proximo"
          : "em_aberto";

    return {
      periodo_inicio: periodStartIso,
      periodo_fim: periodEndIso,
      label: periodStart.toLocaleDateString("pt-PT", { month: "long", year: "numeric" }),
      valor_kz: Number(assinatura?.valor_kz ?? valorPadrao ?? 0),
      status,
      pagamento_id: matchingPayment?.id ?? null,
      comprovativo_url: matchingPayment?.comprovativo_url ?? null,
    };
  });
}

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  try {
    const admin = getAdminClient();

    const { data: centro, error: centroError } = await admin
      .from("centros_formacao")
      .select("escola_id,nome,plano,subscription_status,trial_ends_at,dados_pagamento")
      .eq("escola_id", auth.escolaId)
      .maybeSingle();

    if (centroError) throw centroError;
    if (!centro) return NextResponse.json({ ok: false, error: "Centro não encontrado." }, { status: 404 });

    const { data: assinatura, error: assinaturaError } = await admin
      .from("assinaturas")
      .select("id,plano,ciclo,status,data_inicio,data_renovacao,valor_kz,metodo_pagamento,notas_internas,created_at")
      .eq("escola_id", auth.escolaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (assinaturaError) throw assinaturaError;

    const { data: pagamentos, error: pagamentosError } = await admin
      .from("pagamentos_saas")
      .select("id,status,valor_kz,metodo,referencia_ext,comprovativo_url,confirmado_em,periodo_inicio,periodo_fim,created_at")
      .eq("escola_id", auth.escolaId)
      .order("created_at", { ascending: false })
      .limit(12);

    if (pagamentosError) throw pagamentosError;

    const { data: settings } = await admin
      .from("formacao_plan_settings")
      .select("plan,price_mensal_kz,price_anual_kz,trial_days,discount_percent,promo_label,promo_ends_at")
      .eq("plan", centro.plano)
      .maybeSingle();

    const { data: commercialSettings } = await admin
      .from("super_admin_commercial_settings")
      .select("banco,titular_conta,iban,numero_conta,kwik_chave,email_comercial,telefone_comercial,whatsapp_comercial,link_pagamento")
      .eq("id", true)
      .maybeSingle();

    const mesesAPagar = buildMesesAPagar({
      assinatura: (assinatura as Record<string, unknown> | null) ?? null,
      centro: centro as Record<string, unknown>,
      pagamentos: ((pagamentos ?? []) as Array<Record<string, unknown>>),
      valorPadrao: Number(settings?.price_mensal_kz ?? 0),
    });

    return NextResponse.json({
      ok: true,
      item: {
        centro: {
          ...centro,
          plano_label: mapPlanToLabel(centro.plano),
        },
        assinatura,
        pagamentos: pagamentos ?? [],
        plano: settings,
        payment_instructions: normalizePaymentInstructions((commercialSettings as Record<string, unknown> | null) ?? null),
        meses_a_pagar: mesesAPagar,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
