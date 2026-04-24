import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";

export const dynamic = "force-dynamic";

type CrmRow = {
  escola_id: string;
  escola_nome: string;
  activation_score: number;
  engagement_score: number;
  payment_risk: number;
  support_pressure: number;
  expansion_signal: number;
  churn_risk: number;
  plano: string | null;
  action_href: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const numeric = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

function daysSince(value: string | null | undefined) {
  if (!value) return 365;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 365;
  return Math.max(0, (Date.now() - date.getTime()) / 86_400_000);
}

async function resolveSuperAdmin() {
  const supabase = await supabaseServer();
  const { data: sess } = await supabase.auth.getUser();
  const user = sess?.user;

  if (!user) {
    return { ok: false as const, status: 401, error: "Não autenticado" };
  }

  const { data: roles } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const role = (roles?.[0] as { role?: string } | undefined)?.role;
  if (!isSuperAdminRole(role)) {
    return { ok: false as const, status: 403, error: "Somente Super Admin" };
  }

  return { ok: true as const, supabase };
}

export async function GET() {
  const auth = await resolveSuperAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  try {
    const supabase = auth.supabase;

    const [healthRes, paymentRes, schoolRes] = await Promise.all([
      (supabase as { rpc: (fn: string) => Promise<{ data: unknown; error: unknown }> }).rpc("admin_get_escola_health_metrics"),
      (supabase.from("vw_pagamentos_status" as never) as unknown as {
        select: (fields: string) => Promise<{ data: unknown[] | null; error: unknown }>;
      }).select("escola_id,status,total"),
      (supabase.from("escolas" as never) as unknown as {
        select: (fields: string) => Promise<{ data: unknown[] | null; error: unknown }>;
      }).select("id,nome,plano,status,created_at,last_access"),
    ]);

    if (healthRes.error) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falha ao carregar health metrics.",
          next_step: "Valide a função admin_get_escola_health_metrics no Supabase.",
        },
        { status: 500 },
      );
    }

    const healthRows = (healthRes.data as Array<Record<string, unknown>> | null) ?? [];
    const paymentRows = (paymentRes.data as Array<Record<string, unknown>> | null) ?? [];
    const schools = (schoolRes.data as Array<Record<string, unknown>> | null) ?? [];

    const schoolMap = new Map<string, Record<string, unknown>>();
    for (const school of schools) {
      schoolMap.set(String(school.id), school);
    }

    const paymentMap = new Map<string, { total: number; risk: number }>();
    for (const row of paymentRows) {
      const escolaId = String(row.escola_id ?? "");
      if (!escolaId) continue;

      const entry = paymentMap.get(escolaId) ?? { total: 0, risk: 0 };
      const total = numeric(row.total);
      const status = String(row.status ?? "").toLowerCase();
      entry.total += total;
      if (status.includes("inad") || status.includes("pend") || status.includes("atras")) {
        entry.risk += total;
      }
      paymentMap.set(escolaId, entry);
    }

    const rows: CrmRow[] = healthRows.map((metric) => {
      const escolaId = String(metric.escola_id ?? metric.id ?? "");
      const school = schoolMap.get(escolaId) ?? {};
      const payment = paymentMap.get(escolaId) ?? { total: 0, risk: 0 };

      const onboardingProgress = numeric(metric.progresso_onboarding ?? metric.onboarding_progress ?? 0);
      const onboardingDone = Boolean(metric.onboarding_finalizado ?? metric.onboarding_done ?? onboardingProgress >= 100);
      const alunosAtivos = numeric(metric.total_alunos ?? metric.alunos_ativos ?? metric.students ?? 0);
      const supportTickets = numeric(metric.support_tickets ?? metric.chamados_abertos ?? 0);
      const daysFromAccess = daysSince(
        String(metric.ultimo_acesso ?? metric.last_access ?? school.last_access ?? "") || null,
      );

      const activationScore = clamp(onboardingDone ? 100 : onboardingProgress * 0.85 + (alunosAtivos > 0 ? 15 : 0));
      const engagementScore = clamp(100 - daysFromAccess * 4 + Math.min(alunosAtivos / 8, 20));
      const paymentRisk = clamp(payment.total > 0 ? (payment.risk / payment.total) * 100 : 0);
      const supportPressure = clamp(supportTickets * 15 + (daysFromAccess > 5 ? 20 : 0));
      const expansionSignal = clamp((activationScore * 0.35) + (engagementScore * 0.4) + ((100 - paymentRisk) * 0.25));
      const churnRisk = clamp(((100 - activationScore) * 0.25) + ((100 - engagementScore) * 0.35) + (paymentRisk * 0.3) + (supportPressure * 0.1));

      return {
        escola_id: escolaId,
        escola_nome: String(metric.escola_nome ?? school.nome ?? "Escola sem nome"),
        activation_score: activationScore,
        engagement_score: engagementScore,
        payment_risk: paymentRisk,
        support_pressure: supportPressure,
        expansion_signal: expansionSignal,
        churn_risk: churnRisk,
        plano: (school.plano as string | null | undefined) ?? null,
        action_href: `/super-admin/escolas/${escolaId}`,
      };
    });

    const sortedByChurn = [...rows].sort((a, b) => b.churn_risk - a.churn_risk);
    const topChurn = sortedByChurn.slice(0, 10);
    const readyForUpgrade = rows
      .filter((row) => row.expansion_signal >= 70 && row.payment_risk <= 35 && row.plano !== "premium")
      .sort((a, b) => b.expansion_signal - a.expansion_signal)
      .slice(0, 10);

    const summary = {
      avg_activation_score: clamp(rows.reduce((acc, row) => acc + row.activation_score, 0) / Math.max(rows.length, 1)),
      avg_engagement_score: clamp(rows.reduce((acc, row) => acc + row.engagement_score, 0) / Math.max(rows.length, 1)),
      avg_payment_risk: clamp(rows.reduce((acc, row) => acc + row.payment_risk, 0) / Math.max(rows.length, 1)),
      avg_support_pressure: clamp(rows.reduce((acc, row) => acc + row.support_pressure, 0) / Math.max(rows.length, 1)),
      avg_expansion_signal: clamp(rows.reduce((acc, row) => acc + row.expansion_signal, 0) / Math.max(rows.length, 1)),
      schools_count: rows.length,
    };

    return NextResponse.json(
      {
        ok: true,
        summary,
        top_churn_risk: topChurn,
        ready_for_upgrade: readyForUpgrade,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro interno.",
        next_step: "Verifique logs da API /api/super-admin/crm/overview e conexões Supabase.",
      },
      { status: 500 },
    );
  }
}
