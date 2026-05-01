import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";
import { PLAN_VALUES, type PlanTier } from "@/config/plans";

export const dynamic = "force-dynamic";

const FORMACAO_PLAN_VALUES = ["basic", "pro", "enterprise"] as const;
type FormacaoPlanTier = (typeof FORMACAO_PLAN_VALUES)[number];

type PlanCommercialSettings = {
  plan: PlanTier | FormacaoPlanTier;
  price_mensal_kz: number;
  price_anual_kz: number;
  trial_days: number;
  discount_percent: number;
  promo_label: string | null;
  promo_ends_at: string | null;
  updated_at?: string | null;
};

async function assertSuperAdmin(s: SupabaseClient) {
  const { data: sess } = await s.auth.getUser();
  const user = sess?.user;
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }),
      userId: null,
    };
  }

  const { data: roles } = await s
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const role = (roles?.[0] as { role?: string } | undefined)?.role;
  if (!isSuperAdminRole(role)) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Somente Super Admin" }, { status: 403 }),
      userId: user.id,
    };
  }

  return { ok: true as const, userId: user.id };
}

function toInt(value: unknown, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.round(number));
}

function toDiscount(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(100, Math.max(0, Number(number.toFixed(2))));
}

function cleanText(value: unknown, maxLength = 120) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function cleanDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizePlan(input: unknown, product: "k12" | "formacao"): PlanCommercialSettings | null {
  const raw = (input ?? {}) as Record<string, unknown>;
  const plan = String(raw.plan ?? "").trim().toLowerCase() as PlanTier | FormacaoPlanTier;
  if (product === "k12" && !PLAN_VALUES.includes(plan as PlanTier)) return null;
  if (product === "formacao" && !FORMACAO_PLAN_VALUES.includes(plan as FormacaoPlanTier)) return null;

  return {
    plan,
    price_mensal_kz: toInt(raw.price_mensal_kz),
    price_anual_kz: toInt(raw.price_anual_kz),
    trial_days: Math.min(365, toInt(raw.trial_days, 7)),
    discount_percent: toDiscount(raw.discount_percent),
    promo_label: cleanText(raw.promo_label),
    promo_ends_at: cleanDate(raw.promo_ends_at),
  };
}

export async function GET() {
  try {
    const s = (await supabaseServer()) as unknown as SupabaseClient;
    const auth = await assertSuperAdmin(s);
    if (!auth.ok) return auth.response;

    const [{ data, error }, { data: formacaoData, error: formacaoError }] = await Promise.all([
      s
      .from("app_plan_limits")
      .select("plan, price_mensal_kz, price_anual_kz, trial_days, discount_percent, promo_label, promo_ends_at, updated_at")
      .order("price_mensal_kz", { ascending: true }),
      s
        .from("formacao_plan_settings")
        .select("plan, price_mensal_kz, price_anual_kz, trial_days, discount_percent, promo_label, promo_ends_at, updated_at")
        .order("price_mensal_kz", { ascending: true }),
    ]);

    if (error) throw error;
    if (formacaoError) throw formacaoError;
    return NextResponse.json({ ok: true, items: data ?? [], formacaoItems: formacaoData ?? [] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const s = (await supabaseServer()) as unknown as SupabaseClient;
    const auth = await assertSuperAdmin(s);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const plans = Array.isArray((body as { items?: unknown } | null)?.items)
      ? ((body as { items: unknown[] }).items)
      : [];
    const formacaoPlans = Array.isArray((body as { formacaoItems?: unknown } | null)?.formacaoItems)
      ? ((body as { formacaoItems: unknown[] }).formacaoItems)
      : [];

    const normalized = plans.map((item) => normalizePlan(item, "k12")).filter(Boolean) as PlanCommercialSettings[];
    const uniquePlans = new Set(normalized.map((item) => item.plan));
    if (normalized.length !== PLAN_VALUES.length || uniquePlans.size !== PLAN_VALUES.length) {
      return NextResponse.json({ ok: false, error: "Configuração deve conter os três planos SaaS." }, { status: 400 });
    }

    const normalizedFormacao = formacaoPlans
      .map((item) => normalizePlan(item, "formacao"))
      .filter(Boolean) as PlanCommercialSettings[];
    const uniqueFormacaoPlans = new Set(normalizedFormacao.map((item) => item.plan));
    if (normalizedFormacao.length !== FORMACAO_PLAN_VALUES.length || uniqueFormacaoPlans.size !== FORMACAO_PLAN_VALUES.length) {
      return NextResponse.json({ ok: false, error: "Configuração deve conter os três planos do KLASSE Formação." }, { status: 400 });
    }

    for (const item of normalized) {
      const { error } = await s
        .from("app_plan_limits")
        .update({
          price_mensal_kz: item.price_mensal_kz,
          price_anual_kz: item.price_anual_kz,
          trial_days: item.trial_days,
          discount_percent: item.discount_percent,
          promo_label: item.promo_label,
          promo_ends_at: item.promo_ends_at,
          updated_at: new Date().toISOString(),
        })
        .eq("plan", item.plan);

      if (error) throw error;
    }

    for (const item of normalizedFormacao) {
      const { error } = await s
        .from("formacao_plan_settings")
        .update({
          price_mensal_kz: item.price_mensal_kz,
          price_anual_kz: item.price_anual_kz,
          trial_days: item.trial_days,
          discount_percent: item.discount_percent,
          promo_label: item.promo_label,
          promo_ends_at: item.promo_ends_at,
          updated_at: new Date().toISOString(),
        })
        .eq("plan", item.plan);

      if (error) throw error;
    }

    const [{ data, error }, { data: formacaoData, error: formacaoError }] = await Promise.all([
      s
      .from("app_plan_limits")
      .select("plan, price_mensal_kz, price_anual_kz, trial_days, discount_percent, promo_label, promo_ends_at, updated_at")
      .order("price_mensal_kz", { ascending: true }),
      s
        .from("formacao_plan_settings")
        .select("plan, price_mensal_kz, price_anual_kz, trial_days, discount_percent, promo_label, promo_ends_at, updated_at")
        .order("price_mensal_kz", { ascending: true }),
    ]);

    if (error) throw error;
    if (formacaoError) throw formacaoError;
    return NextResponse.json({ ok: true, items: data ?? [], formacaoItems: formacaoData ?? [] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno" }, { status: 500 });
  }
}
