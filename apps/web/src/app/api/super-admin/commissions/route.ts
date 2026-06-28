import { NextRequest, NextResponse } from "next/server";

import { requireSuperAdminRoute } from "@/lib/auth/requireSuperAdminRoute";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_VALUES = new Set(["pending", "approved", "blocked", "paid", "cancelled"]);

type CommissionRow = {
  id: string;
  afiliado_id: string;
  afiliado_codigo: string;
  membro_id: string | null;
  escola_id: string;
  onboarding_request_id: string | null;
  crm_lead_id: string | null;
  assinatura_id: string | null;
  pagamento_saas_id: string | null;
  tipo: string;
  base_valor_kz: number;
  percentual: number;
  valor_kz: number;
  status: string;
  competencia_inicio: string | null;
  competencia_fim: string | null;
  due_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  metadata?: unknown;
};

type SchoolRow = { id: string; nome: string | null };
type AffiliateRow = { id: string; codigo: string | null; nome: string | null };
type MemberRow = { id: string; nome: string | null };
type SubscriptionRow = {
  id: string;
  plano: string | null;
  ciclo: string | null;
  status: string | null;
  valor_kz: number | null;
  data_renovacao: string | null;
};
type PaymentRow = {
  id: string;
  status: string | null;
  valor_kz: number | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  confirmado_em: string | null;
  created_at: string | null;
};

function uniq(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdminRoute();
  if (!auth.ok) return auth.response;

  try {
    const supabase = auth.supabase;
    const params = request.nextUrl.searchParams;
    const rawStatus = (params.get("status") || "all").trim().toLowerCase();
    const rawAffiliate = (params.get("afiliado") || "").trim().toUpperCase();
    const search = (params.get("search") || "").trim().toLowerCase();
    const limit = Math.min(200, Math.max(1, Number(params.get("limit") || 120)));

    let query = (supabase as any).from("partner_commissions").select("*").order("created_at", { ascending: false }).limit(limit);
    if (STATUS_VALUES.has(rawStatus)) {
      query = query.eq("status", rawStatus);
    }
    if (rawAffiliate) {
      query = query.eq("afiliado_codigo", rawAffiliate);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = ((data as CommissionRow[] | null) ?? []).map((row) => ({
      ...row,
      base_valor_kz: numberValue(row.base_valor_kz),
      percentual: numberValue(row.percentual),
      valor_kz: numberValue(row.valor_kz),
    }));

    const escolaIds = uniq(rows.map((row) => row.escola_id));
    const afiliadoIds = uniq(rows.map((row) => row.afiliado_id));
    const membroIds = uniq(rows.map((row) => row.membro_id));
    const assinaturaIds = uniq(rows.map((row) => row.assinatura_id));
    const pagamentoIds = uniq(rows.map((row) => row.pagamento_saas_id));

    const [
      schoolsRes,
      affiliatesRes,
      membersRes,
      subscriptionsRes,
      paymentsRes,
    ] = await Promise.all([
      escolaIds.length
        ? supabase.from("escolas").select("id,nome").in("id", escolaIds)
        : Promise.resolve({ data: [] as SchoolRow[], error: null }),
      afiliadoIds.length
        ? supabase.from("afiliados").select("id,codigo,nome").in("id", afiliadoIds)
        : Promise.resolve({ data: [] as AffiliateRow[], error: null }),
      membroIds.length
        ? (supabase as any).from("afiliado_membros").select("id,nome").in("id", membroIds)
        : Promise.resolve({ data: [] as MemberRow[], error: null }),
      assinaturaIds.length
        ? supabase.from("assinaturas").select("id,plano,ciclo,status,valor_kz,data_renovacao").in("id", assinaturaIds)
        : Promise.resolve({ data: [] as SubscriptionRow[], error: null }),
      pagamentoIds.length
        ? supabase.from("pagamentos_saas").select("id,status,valor_kz,periodo_inicio,periodo_fim,confirmado_em,created_at").in("id", pagamentoIds)
        : Promise.resolve({ data: [] as PaymentRow[], error: null }),
    ]);

    if (schoolsRes.error || affiliatesRes.error || membersRes.error || subscriptionsRes.error || paymentsRes.error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            schoolsRes.error?.message ||
            affiliatesRes.error?.message ||
            membersRes.error?.message ||
            subscriptionsRes.error?.message ||
            paymentsRes.error?.message ||
            "Falha ao hidratar relações das comissões.",
        },
        { status: 500 },
      );
    }

    const schoolMap = new Map(((schoolsRes.data as SchoolRow[] | null) ?? []).map((row) => [row.id, row]));
    const affiliateMap = new Map(((affiliatesRes.data as AffiliateRow[] | null) ?? []).map((row) => [row.id, row]));
    const memberMap = new Map(((membersRes.data as MemberRow[] | null) ?? []).map((row) => [row.id, row]));
    const subscriptionMap = new Map(((subscriptionsRes.data as SubscriptionRow[] | null) ?? []).map((row) => [row.id, row]));
    const paymentMap = new Map(((paymentsRes.data as PaymentRow[] | null) ?? []).map((row) => [row.id, row]));

    let items = rows.map((row) => {
      const school = schoolMap.get(row.escola_id);
      const affiliate = affiliateMap.get(row.afiliado_id);
      const member = row.membro_id ? memberMap.get(row.membro_id) : null;
      const subscription = row.assinatura_id ? subscriptionMap.get(row.assinatura_id) : null;
      const payment = row.pagamento_saas_id ? paymentMap.get(row.pagamento_saas_id) : null;

      return {
        ...row,
        escola_nome: school?.nome ?? "Escola sem nome",
        afiliado_nome: affiliate?.nome ?? row.afiliado_codigo,
        membro_nome: member?.nome ?? null,
        assinatura: subscription
          ? {
              id: subscription.id,
              plano: subscription.plano,
              ciclo: subscription.ciclo,
              status: subscription.status,
              valor_kz: numberValue(subscription.valor_kz),
              data_renovacao: subscription.data_renovacao,
            }
          : null,
        pagamento: payment
          ? {
              id: payment.id,
              status: payment.status,
              valor_kz: numberValue(payment.valor_kz),
              periodo_inicio: payment.periodo_inicio,
              periodo_fim: payment.periodo_fim,
              confirmado_em: payment.confirmado_em,
              created_at: payment.created_at,
            }
          : null,
      };
    });

    if (search) {
      items = items.filter((item) =>
        [
          item.afiliado_codigo,
          item.afiliado_nome,
          item.escola_nome,
          item.membro_nome ?? "",
          item.tipo,
          item.status,
          item.assinatura?.plano ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(search),
      );
    }

    const summary = items.reduce(
      (acc, item) => {
        acc.total_kz += item.valor_kz;
        acc.total_count += 1;
        if (item.status === "pending") {
          acc.pending_kz += item.valor_kz;
          acc.pending_count += 1;
        } else if (item.status === "approved") {
          acc.approved_kz += item.valor_kz;
          acc.approved_count += 1;
        } else if (item.status === "blocked") {
          acc.blocked_kz += item.valor_kz;
          acc.blocked_count += 1;
        } else if (item.status === "paid") {
          acc.paid_kz += item.valor_kz;
          acc.paid_count += 1;
        } else if (item.status === "cancelled") {
          acc.cancelled_kz += item.valor_kz;
          acc.cancelled_count += 1;
        }
        return acc;
      },
      {
        total_kz: 0,
        total_count: 0,
        pending_kz: 0,
        pending_count: 0,
        approved_kz: 0,
        approved_count: 0,
        blocked_kz: 0,
        blocked_count: 0,
        paid_kz: 0,
        paid_count: 0,
        cancelled_kz: 0,
        cancelled_count: 0,
      },
    );

    const afiliados = [...new Set(items.map((item) => item.afiliado_codigo))]
      .sort()
      .map((codigo) => {
        const sample = items.find((item) => item.afiliado_codigo === codigo);
        return { codigo, nome: sample?.afiliado_nome ?? codigo };
      });

    return NextResponse.json(
      {
        ok: true,
        items,
        summary,
        filters: { afiliados },
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro interno ao carregar comissões." },
      { status: 500 },
    );
  }
}
