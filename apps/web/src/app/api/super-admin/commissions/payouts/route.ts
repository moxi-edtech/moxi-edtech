import { NextRequest, NextResponse } from "next/server";

import { requireSuperAdminRoute } from "@/lib/auth/requireSuperAdminRoute";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_VALUES = new Set(["requested", "approved", "paid", "rejected", "cancelled"]);

type PayoutRow = {
  id: string;
  afiliado_id: string;
  afiliado_codigo: string;
  requested_by_membro_id: string | null;
  status: string;
  total_kz: number | null;
  receipt_file_path: string;
  receipt_file_name: string;
  receipt_file_type: string | null;
  receipt_file_size: number | null;
  requested_at: string;
  approved_at: string | null;
  paid_at: string | null;
  rejected_at: string | null;
  metadata: unknown;
};

type PayoutItemRow = {
  payout_id: string;
  commission_id: string;
  valor_kz: number | null;
};

type CommissionRow = {
  id: string;
  escola_id: string;
  tipo: string;
  status: string;
  valor_kz: number | null;
  created_at: string;
};

type AffiliateRow = { id: string; codigo: string | null; nome: string | null };
type MemberRow = { id: string; nome: string | null };
type SchoolRow = { id: string; nome: string | null };

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
    const limit = Math.min(100, Math.max(1, Number(params.get("limit") || 50)));

    let query = (supabase as any)
      .from("partner_commission_payouts")
      .select("*")
      .order("requested_at", { ascending: false })
      .limit(limit);

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

    const payouts = ((data as PayoutRow[] | null) ?? []).map((row) => ({
      ...row,
      total_kz: numberValue(row.total_kz),
    }));

    const payoutIds = payouts.map((row) => row.id);
    const affiliateIds = uniq(payouts.map((row) => row.afiliado_id));
    const memberIds = uniq(payouts.map((row) => row.requested_by_membro_id));

    const [itemsRes, affiliatesRes, membersRes] = await Promise.all([
      payoutIds.length
        ? (supabase as any).from("partner_commission_payout_items").select("*").in("payout_id", payoutIds)
        : Promise.resolve({ data: [] as PayoutItemRow[], error: null }),
      affiliateIds.length
        ? supabase.from("afiliados").select("id,codigo,nome").in("id", affiliateIds)
        : Promise.resolve({ data: [] as AffiliateRow[], error: null }),
      memberIds.length
        ? (supabase as any).from("afiliado_membros").select("id,nome").in("id", memberIds)
        : Promise.resolve({ data: [] as MemberRow[], error: null }),
    ]);

    if (itemsRes.error || affiliatesRes.error || membersRes.error) {
      return NextResponse.json(
        { ok: false, error: itemsRes.error?.message || affiliatesRes.error?.message || membersRes.error?.message },
        { status: 500 },
      );
    }

    const payoutItems = ((itemsRes.data as PayoutItemRow[] | null) ?? []).map((row) => ({
      ...row,
      valor_kz: numberValue(row.valor_kz),
    }));
    const commissionIds = uniq(payoutItems.map((row) => row.commission_id));

    const { data: commissionsData, error: commissionsError } = commissionIds.length
      ? await (supabase as any)
          .from("partner_commissions")
          .select("id,escola_id,tipo,status,valor_kz,created_at")
          .in("id", commissionIds)
      : { data: [] as CommissionRow[], error: null };

    if (commissionsError) {
      return NextResponse.json({ ok: false, error: commissionsError.message }, { status: 500 });
    }

    const commissions = ((commissionsData as CommissionRow[] | null) ?? []).map((row) => ({
      ...row,
      valor_kz: numberValue(row.valor_kz),
    }));
    const schoolIds = uniq(commissions.map((row) => row.escola_id));

    const { data: schoolsData, error: schoolsError } = schoolIds.length
      ? await supabase.from("escolas").select("id,nome").in("id", schoolIds)
      : { data: [] as SchoolRow[], error: null };

    if (schoolsError) {
      return NextResponse.json({ ok: false, error: schoolsError.message }, { status: 500 });
    }

    const affiliateMap = new Map(((affiliatesRes.data as AffiliateRow[] | null) ?? []).map((row) => [row.id, row]));
    const memberMap = new Map(((membersRes.data as MemberRow[] | null) ?? []).map((row) => [row.id, row]));
    const commissionMap = new Map(commissions.map((row) => [row.id, row]));
    const schoolMap = new Map(((schoolsData as SchoolRow[] | null) ?? []).map((row) => [row.id, row]));
    const itemsByPayout = payoutItems.reduce((acc, item) => {
      const list = acc.get(item.payout_id) ?? [];
      list.push(item);
      acc.set(item.payout_id, list);
      return acc;
    }, new Map<string, PayoutItemRow[]>());

    const signedUrlResults = await Promise.all(
      payouts.map(async (payout) => {
        const { data: signedData } = await supabase.storage
          .from("onboarding")
          .createSignedUrl(payout.receipt_file_path, 60 * 30);
        return [payout.id, signedData?.signedUrl ?? null] as const;
      }),
    );
    const signedUrlMap = new Map(signedUrlResults);

    const hydrated = payouts.map((payout) => {
      const affiliate = affiliateMap.get(payout.afiliado_id);
      const member = payout.requested_by_membro_id ? memberMap.get(payout.requested_by_membro_id) : null;
      const items = (itemsByPayout.get(payout.id) ?? []).map((item) => {
        const commission = commissionMap.get(item.commission_id) ?? null;
        const school = commission?.escola_id ? schoolMap.get(commission.escola_id) : null;
        return {
          ...item,
          commission: commission
            ? {
                ...commission,
                escola_nome: school?.nome ?? "Escola sem nome",
              }
            : null,
        };
      });

      return {
        ...payout,
        afiliado_nome: affiliate?.nome ?? payout.afiliado_codigo,
        requested_by_nome: member?.nome ?? null,
        receipt_signed_url: signedUrlMap.get(payout.id) ?? null,
        commission_count: items.length,
        items,
      };
    });

    const summary = hydrated.reduce(
      (acc, payout) => {
        acc.total_kz += payout.total_kz;
        acc.total_count += 1;
        if (payout.status === "requested") {
          acc.requested_kz += payout.total_kz;
          acc.requested_count += 1;
        } else if (payout.status === "approved") {
          acc.approved_kz += payout.total_kz;
          acc.approved_count += 1;
        } else if (payout.status === "paid") {
          acc.paid_kz += payout.total_kz;
          acc.paid_count += 1;
        } else if (payout.status === "rejected") {
          acc.rejected_kz += payout.total_kz;
          acc.rejected_count += 1;
        } else if (payout.status === "cancelled") {
          acc.cancelled_kz += payout.total_kz;
          acc.cancelled_count += 1;
        }
        return acc;
      },
      {
        total_kz: 0,
        total_count: 0,
        requested_kz: 0,
        requested_count: 0,
        approved_kz: 0,
        approved_count: 0,
        paid_kz: 0,
        paid_count: 0,
        rejected_kz: 0,
        rejected_count: 0,
        cancelled_kz: 0,
        cancelled_count: 0,
      },
    );

    return NextResponse.json(
      { ok: true, payouts: hydrated, summary },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro interno ao carregar payouts." },
      { status: 500 },
    );
  }
}
