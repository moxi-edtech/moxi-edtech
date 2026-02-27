// apps/web/src/components/layout/escola-admin/EscolaAdminDashboardData.tsx
import "server-only";

import { cookies, headers } from "next/headers";
import { supabaseServer }    from "@/lib/supabaseServer";
import { applyKf2ListInvariants } from "@/lib/kf2";
import EscolaAdminDashboardContent from "./EscolaAdminDashboardContent";

import type {
  KpiStats,
  SetupStatus,
  Aviso,
  Evento,
  CurriculoPendencias,
  DashboardCharts,
  InadimplenciaTopRow,
  PagamentoRecenteRow,
} from "./dashboard.types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hasComponentes = (config?: { componentes?: { code: string }[] }) =>
  Array.isArray(config?.componentes) && config.componentes.length > 0;

/** "2024/2025" from the active letivo year, or current/next calendar years. */
function deriveAnoLetivo(anoAtivo?: number | null): string {
  const base = anoAtivo ?? new Date().getFullYear();
  return `${base}/${base + 1}`;
}

type Props = { escolaId: string; escolaNome?: string };

// ─── Component ────────────────────────────────────────────────────────────────

export default async function EscolaAdminDashboardData({ escolaId, escolaNome }: Props) {
  const s            = await supabaseServer();
  const cookieHeader = (await cookies()).toString();
  const host         = (await headers()).get("host");
  const protocol     = process.env.NODE_ENV === "development" ? "http" : "https";
  const baseUrl      = host ? `${protocol}://${host}` : "";

  // Scoped to this escola — fixes the "/financeiro" global fallback bug
  const financeiroHref = `/escola/${escolaId}/financeiro`;

  const fetchJson = async <T,>(path: string, fallback: T): Promise<T> => {
    if (!baseUrl) return fallback;
    try {
      const res  = await fetch(`${baseUrl}${path}`, {
        cache: "no-store",
        headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) return fallback;
      return json as T;
    } catch {
      return fallback;
    }
  };

  // ─── Empty setup status used in error fallback ───────────────────────────
  const emptySetupStatus: SetupStatus = {
    anoLetivoOk:           false,
    periodosOk:            false,
    avaliacaoOk:           false,
    frequenciaOk:          false,
    avaliacaoFrequenciaOk: false,
    curriculoOk:           false,
    turmasOk:              false,
    setupComplete:         false,
  };

  const emptyKpis: KpiStats = { alunos: 0, turmas: 0, professores: 0, avaliacoes: 0 };

  try {
    const todayKey = new Date().toISOString().slice(0, 10);

    let missingPricingQuery = s
      .from("vw_financeiro_missing_pricing_count")
      .select("ano_letivo, missing_count")
      .eq("escola_id", escolaId);
    missingPricingQuery = applyKf2ListInvariants(missingPricingQuery, {
      defaultLimit: 1,
      order: [{ column: "ano_letivo", ascending: false }],
    });

    let financeiroKpiQuery = s
      .from("vw_financeiro_kpis_mes")
      .select("mes_ref, previsto_total, realizado_total")
      .eq("escola_id", escolaId);
    financeiroKpiQuery = applyKf2ListInvariants(financeiroKpiQuery, {
      defaultLimit: 1,
      order: [{ column: "mes_ref", ascending: false }],
    });

    const [
      dashboardCounts,
      pendingTurmasResult,
      draftCurriculosResult,
      setupStatusResult,
      configResult,
      anoLetivoResult,
      missingPricingResult,
      financeiroKpiResult,
      escolaNomeResult,
      dashboardChartsRes,
      inadimplenciaTopRes,
      pagamentosRecentesRes,
    ] = await Promise.all([
      s.from("vw_admin_dashboard_counts")
        .select("alunos_ativos, turmas_total, professores_total, avaliacoes_total")
        .eq("escola_id", escolaId)
        .maybeSingle(),

      s.from("vw_admin_pending_turmas_count")
        .select("pendentes_total")
        .eq("escola_id", escolaId)
        .maybeSingle(),

      s.from("curso_curriculos")
        .select("id")
        .eq("escola_id", escolaId)
        .eq("status", "draft"),

      s.from("vw_escola_setup_status")
        .select("has_ano_letivo_ativo, has_3_trimestres, has_curriculo_published, has_turmas_no_ano")
        .eq("escola_id", escolaId)
        .maybeSingle(),

      s.from("configuracoes_escola")
        .select("frequencia_modelo, frequencia_min_percent, modelo_avaliacao, avaliacao_config")
        .eq("escola_id", escolaId)
        .maybeSingle(),

      // Fetch active ano_letivo year for the header badge
      s.from("anos_letivos")
        .select("ano")
        .eq("escola_id", escolaId)
        .eq("status", "ativo")
        .maybeSingle(),

      missingPricingQuery,
      financeiroKpiQuery,

      s.from("escolas").select("nome").eq("id", escolaId).maybeSingle(),

      fetchJson(`/api/escolas/${escolaId}/admin/dashboard`, { ok: false, charts: null }),

      fetchJson<{ ok: boolean; data: InadimplenciaTopRow[] }>(
        `/api/escolas/${escolaId}/admin/financeiro/inadimplencia-top?limit=5`,
        { ok: false, data: [] }
      ),

      // Note: when the API is updated to include aluno_nome, this type will be satisfied.
      fetchJson<{ ok: boolean; data: PagamentoRecenteRow[] }>(
        `/api/escolas/${escolaId}/admin/financeiro/pagamentos-recentes?limit=10&day_key=${todayKey}`,
        { ok: false, data: [] }
      ),
    ]);

    // ─── Setup status ──────────────────────────────────────────────────────
    const setupData  = setupStatusResult.data;
    const config     = configResult.data;
    const avaliacaoOk           = hasComponentes(config?.avaliacao_config as any);
    const frequenciaOk          = Boolean(config?.frequencia_modelo)
      && typeof config?.frequencia_min_percent === "number";
    const avaliacaoFrequenciaOk = avaliacaoOk && frequenciaOk;

    const setupStatus: SetupStatus = {
      anoLetivoOk:           Boolean(setupData?.has_ano_letivo_ativo),
      periodosOk:            Boolean(setupData?.has_3_trimestres),
      avaliacaoOk,
      frequenciaOk,
      avaliacaoFrequenciaOk,
      curriculoOk:           Boolean(setupData?.has_curriculo_published),
      turmasOk:              Boolean(setupData?.has_turmas_no_ano),
      setupComplete:         false,
    };
    setupStatus.setupComplete = (
      setupStatus.anoLetivoOk &&
      setupStatus.periodosOk &&
      setupStatus.avaliacaoFrequenciaOk &&
      setupStatus.curriculoOk &&
      setupStatus.turmasOk
    );

    // ─── KPIs ─────────────────────────────────────────────────────────────
    const financeiroKpis = (financeiroKpiResult.data ?? []) as Array<{
      mes_ref?:        string | null;
      previsto_total?: number | null;
      realizado_total?: number | null;
    }>;
    const kpiAtual          = financeiroKpis[0];
    const previsto          = Number(kpiAtual?.previsto_total  ?? 0);
    const realizado         = Number(kpiAtual?.realizado_total ?? 0);
    const financeiroPercent = previsto > 0 ? Math.round((realizado / previsto) * 100) : 0;

    const stats: KpiStats = {
      alunos:     dashboardCounts.data?.alunos_ativos   ?? 0,
      turmas:     dashboardCounts.data?.turmas_total    ?? 0,
      professores: dashboardCounts.data?.professores_total ?? 0,
      avaliacoes: dashboardCounts.data?.avaliacoes_total ?? 0,
      financeiro: financeiroPercent,
    };

    // ─── Currículo pendencies ─────────────────────────────────────────────
    const draftIds = (draftCurriculosResult.data ?? [])
      .map((r: any) => r.id)
      .filter(Boolean);

    let curriculoPendencias: CurriculoPendencias = { horario: 0, avaliacao: 0 };

    if (draftIds.length > 0) {
      const [horarioRes, avaliacaoRes] = await Promise.all([
        s.from("curso_matriz")
          .select("disciplina_id")
          .eq("escola_id", escolaId)
          .eq("status_horario", "incompleto")
          .in("curso_curriculo_id", draftIds),
        s.from("curso_matriz")
          .select("disciplina_id")
          .eq("escola_id", escolaId)
          .eq("status_avaliacao", "incompleto")
          .in("curso_curriculo_id", draftIds),
      ]);

      curriculoPendencias = {
        horario:   new Set((horarioRes.data  ?? []).map((r: any) => r.disciplina_id).filter(Boolean)).size,
        avaliacao: new Set((avaliacaoRes.data ?? []).map((r: any) => r.disciplina_id).filter(Boolean)).size,
      };
    }

    // ─── Derived values ───────────────────────────────────────────────────
    const anoLetivo        = deriveAnoLetivo(anoLetivoResult.data?.ano ?? undefined);
    const pendingTurmasCount = pendingTurmasResult.data?.pendentes_total ?? 0;
    const missingPricingCount = Number(missingPricingResult.data?.[0]?.missing_count ?? 0);
    const charts           = (dashboardChartsRes as any)?.charts as DashboardCharts | undefined;
    const inadimplenciaTop = (inadimplenciaTopRes as any)?.data  as InadimplenciaTopRow[] ?? [];
    const pagamentosRecentes = (pagamentosRecentesRes as any)?.data as PagamentoRecenteRow[] ?? [];
    const avisos: Aviso[]  = [];
    const eventos: Evento[] = [];

    return (
      <EscolaAdminDashboardContent
        escolaId={escolaId}
        escolaNome={escolaNome ?? escolaNomeResult.data?.nome ?? undefined}
        anoLetivo={anoLetivo}
        loading={false}
        error={null}
        stats={stats}
        pendingTurmasCount={pendingTurmasCount}
        notices={avisos}
        events={eventos}
        charts={charts}
        setupStatus={setupStatus}
        missingPricingCount={missingPricingCount}
        financeiroHref={financeiroHref}
        inadimplenciaTop={inadimplenciaTop}
        pagamentosRecentes={pagamentosRecentes}
        receitaResumo={{
          previsto,
          realizado,
        }}
        curriculoPendencias={curriculoPendencias}
      />
    );
  } catch (e: any) {
    return (
      <EscolaAdminDashboardContent
        escolaId={escolaId}
        escolaNome={escolaNome}
        anoLetivo={deriveAnoLetivo(null)}
        loading={false}
        error={e?.message ?? "Falha ao carregar dashboard"}
        stats={emptyKpis}
        pendingTurmasCount={0}
        notices={[]}
        events={[]}
        charts={undefined}
        setupStatus={emptySetupStatus}
        missingPricingCount={0}
        financeiroHref={financeiroHref}
        inadimplenciaTop={[]}
        pagamentosRecentes={[]}
        receitaResumo={{
          previsto: 0,
          realizado: 0,
        }}
        curriculoPendencias={{ horario: 0, avaliacao: 0 }}
      />
    );
  }
}
