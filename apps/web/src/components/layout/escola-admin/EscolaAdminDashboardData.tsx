// apps/web/src/components/layout/escola-admin/EscolaAdminDashboardData.tsx
import "server-only";

import { cookies, headers } from "next/headers";
import { supabaseServer }    from "@/lib/supabaseServer";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import EscolaAdminDashboardContent from "./EscolaAdminDashboardContent";

import type {
  KpiStats,
  SetupStatus,
  Aviso,
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

function getLocalDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

type Props = { escolaId: string; escolaNome?: string };

// ─── Component ────────────────────────────────────────────────────────────────

export default async function EscolaAdminDashboardData({ escolaId, escolaNome }: Props) {
  const s            = await supabaseServer();
  const { data: userRes } = await s.auth.getUser();
  const user = userRes?.user ?? null;
  const cookieHeader = (await cookies()).toString();
  const host         = (await headers()).get("host");
  const protocol     = process.env.NODE_ENV === "development" ? "http" : "https";
  const baseUrl      = host ? `${protocol}://${host}` : "";
  const metaEscolaId = (user?.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
  const resolvedEscolaId = user
    ? await resolveEscolaIdForUser(
        s as any,
        user.id,
        escolaId,
        metaEscolaId ? String(metaEscolaId) : null
      )
    : null;
  const scopedEscolaId = resolvedEscolaId ?? (escolaId !== "null" ? (escolaId || null) : null);
  const isValidId = Boolean(scopedEscolaId && scopedEscolaId !== "null");

  const fetchJson = async <T,>(
    path: string,
    fallback: T,
    options?: { cache?: RequestCache; revalidate?: number }
  ): Promise<T> => {
    if (!baseUrl || !isValidId) return fallback;
    try {
      const cacheMode = options?.cache ?? "no-store";
      const res  = await fetch(`${baseUrl}${path}`, {
        cache: cacheMode,
        next: options?.revalidate != null ? { revalidate: options.revalidate } : undefined,
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
  let financeiroHref = `/escola/${escolaId}/financeiro`;

  try {
    if (!isValidId) throw new Error("ID de escola inválido ou ausente.");
    const validId = scopedEscolaId as string;

    const todayKey = getLocalDayKey();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentMonthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

    let missingPricingQuery = s
      .from("vw_financeiro_missing_pricing_count")
      .select("ano_letivo, missing_count")
      .eq("escola_id", validId);
    missingPricingQuery = applyKf2ListInvariants(missingPricingQuery, {
      defaultLimit: 1,
      order: [{ column: "ano_letivo", ascending: false }],
      tieBreakerColumn: "ano_letivo",
    });

    let financeiroKpiQuery = s
      .from("vw_financeiro_kpis_mes")
      .select("mes_ref, previsto_total, realizado_total, pago_competencia_total")
      .eq("escola_id", validId)
      .eq("mes_ref", currentMonthStart);
    financeiroKpiQuery = applyKf2ListInvariants(financeiroKpiQuery, {
      defaultLimit: 1,
      order: [{ column: "mes_ref", ascending: false }],
      tieBreakerColumn: "mes_ref",
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
      matriculasMesResult,
      mensalidadesStatusResult,
      inadimplenciaTopRes,
      pagamentosRecentesRes,
      estadoVitalRes,
    ] = await Promise.all([
      s.from("vw_admin_dashboard_counts")
        .select("alunos_ativos, turmas_total, professores_total, avaliacoes_total")
        .eq("escola_id", validId)
        .maybeSingle(),

      s.from("vw_admin_pending_turmas_count")
        .select("pendentes_total")
        .eq("escola_id", validId)
        .maybeSingle(),

      s.from("curso_curriculos")
        .select("id")
        .eq("escola_id", validId)
        .eq("status", "draft"),

      s.from("vw_escola_setup_status")
        .select("has_ano_letivo_ativo, has_3_trimestres, has_curriculo_published, has_turmas_no_ano")
        .eq("escola_id", validId)
        .maybeSingle(),

      s.from("configuracoes_escola")
        .select("frequencia_modelo, frequencia_min_percent, modelo_avaliacao, avaliacao_config")
        .eq("escola_id", validId)
        .maybeSingle(),

      // Fetch active ano_letivo year for the header badge
      s.from("anos_letivos")
        .select("ano")
        .eq("escola_id", validId)
        .eq("ativo", true)
        .maybeSingle(),

      missingPricingQuery,
      financeiroKpiQuery,

      s.from("escolas").select("nome, slug").eq("id", validId).maybeSingle(),

      s.from("vw_admin_matriculas_por_mes" as any)
        .select("mes, total")
        .eq("escola_id", validId)
        .order("mes", { ascending: true }),

      s.from("vw_mensalidades_operacional_status_ano_ativo" as any)
        .select("status_operacional, total")
        .eq("escola_id", validId),

      fetchJson<{ ok: boolean; data: InadimplenciaTopRow[] }>(
        `/api/escolas/${escolaId}/admin/financeiro/inadimplencia-top?limit=5`,
        { ok: false, data: [] }
      ),

      fetchJson<{ ok: boolean; data: PagamentoRecenteRow[] }>(
        `/api/escolas/${escolaId}/admin/financeiro/pagamentos-recentes?limit=10&day_key=${todayKey}`,
        { ok: false, data: [] },
        { cache: "force-cache", revalidate: 20 }
      ),

      fetchJson<{ ok: boolean; estado: any }>(
        `/api/escola/${escolaId}/admin/estado-hoje`,
        { ok: false, estado: null }
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
      mes_ref?:                string | null;
      previsto_total?:         number | null;
      realizado_total?:        number | null;
      pago_competencia_total?: number | null;
    }>;
    const kpiAtual          = financeiroKpis[0];
    const previsto          = Number(kpiAtual?.previsto_total          ?? 0);
    const realizado         = Number(kpiAtual?.realizado_total         ?? 0);
    const pago_competencia  = Number(kpiAtual?.pago_competencia_total  ?? 0);

    // Top KPI uses "Cobrança da competência" (capped at 100% for the card usually)
    const financeiroPercent =
      previsto > 0
        ? Math.min(100, Math.round((pago_competencia / previsto) * 100))
        : pago_competencia > 0
          ? 100
          : 0;

    const stats: KpiStats = {
      alunos:      dashboardCounts.data?.alunos_ativos   ?? 0,
      turmas:      dashboardCounts.data?.turmas_total    ?? 0,
      professores: dashboardCounts.data?.professores_total ?? 0,
      avaliacoes:  dashboardCounts.data?.avaliacoes_total ?? 0,
      financeiro:  financeiroPercent,
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
          .eq("escola_id", validId)
          .eq("status_horario", "incompleto")
          .in("curso_curriculo_id", draftIds),
        s.from("curso_matriz")
          .select("disciplina_id")
          .eq("escola_id", validId)
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
    const escolaParam = escolaNomeResult.data?.slug ? String(escolaNomeResult.data.slug) : escolaId;
    financeiroHref = `/escola/${escolaParam}/financeiro`;
    const pendingTurmasCount = pendingTurmasResult.data?.pendentes_total ?? 0;
    const missingPricingCount = Number(missingPricingResult.data?.[0]?.missing_count ?? 0);
    const meses = ["Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez", "Jan", "Fev", "Mar", "Abr", "Mai"];
    const matriculasMesRows = (matriculasMesResult.data ?? []) as Array<{ mes?: string | null; total?: number | null }>;
    const nowRef = new Date();
    const monthKeys: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(nowRef.getFullYear(), nowRef.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const alunosPorMes = new Array(12).fill(0);
    matriculasMesRows.forEach((row) => {
      const raw = String(row.mes ?? "");
      const match = /^(\d{4})-(\d{2})/.exec(raw);
      if (!match) return;
      const key = `${match[1]}-${match[2]}`;
      const idx = monthKeys.indexOf(key);
      if (idx >= 0) alunosPorMes[idx] = Number(row.total ?? 0);
    });

    const statusRows = (mensalidadesStatusResult.data ?? []) as Array<{ status_operacional?: string | null; total?: number | null }>;
    const pagamentosResumo = { pago: 0, pendente: 0, inadimplente: 0, ajuste: 0 };
    statusRows.forEach((row) => {
      const status = String(row.status_operacional ?? "").toLowerCase();
      const total = Number(row.total ?? 0);
      if (status === "pago") pagamentosResumo.pago += total;
      else if (status === "pendente") pagamentosResumo.pendente += total;
      else if (status === "inadimplente") pagamentosResumo.inadimplente += total;
    });

    const charts: DashboardCharts = {
      meses,
      alunosPorMes,
      pagamentos: pagamentosResumo,
    };
    const inadimplenciaTop = (inadimplenciaTopRes as any)?.data  as InadimplenciaTopRow[] ?? [];
    const pagamentosRecentes = (pagamentosRecentesRes as any)?.data as PagamentoRecenteRow[] ?? [];
    const estadoVital      = (estadoVitalRes as any)?.estado ?? null;
    const avisos: Aviso[]  = [];

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
        charts={charts}
        setupStatus={setupStatus}
        missingPricingCount={missingPricingCount}
        financeiroHref={financeiroHref}
        inadimplenciaTop={inadimplenciaTop}
        pagamentosRecentes={pagamentosRecentes}
        receitaResumo={{
          previsto,
          realizado,
          pago_competencia,
        }}
        curriculoPendencias={curriculoPendencias}
        estadoVital={estadoVital}
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
        charts={undefined}
        setupStatus={emptySetupStatus}
        missingPricingCount={0}
        financeiroHref={financeiroHref}
        inadimplenciaTop={[]}
        pagamentosRecentes={[]}
        receitaResumo={{
          previsto: 0,
          realizado: 0,
          pago_competencia: 0,
        }}
        curriculoPendencias={{ horario: 0, avaliacao: 0 }}
      />
    );
  }
}
