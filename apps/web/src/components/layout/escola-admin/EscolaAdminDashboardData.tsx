// apps/web/src/components/layout/escola-admin/EscolaAdminDashboardData.tsx
import "server-only";

import { cookies, headers } from "next/headers";
import EscolaAdminDashboardContent from "./EscolaAdminDashboardContent";
import { supabaseServer } from "@/lib/supabaseServer";
import type { KpiStats } from "./KpiSection";
import type { SetupStatus } from "./setupStatus";
import { applyKf2ListInvariants } from "@/lib/kf2";

/**
 * Padrão KLASSE:
 * - Server component busca tudo
 * - Passa apenas plain objects para o client component (Content)
 * - Zero fetch() no client para dados do dashboard
 */
type Aviso = { id: string; titulo: string; dataISO: string };
type Evento = { id: string; titulo: string; dataISO: string };
type InadimplenciaTopRow = {
  aluno_id: string;
  aluno_nome: string;
  valor_em_atraso: number;
  dias_em_atraso: number;
};
type PagamentoRecenteRow = {
  id: string;
  aluno_id: string | null;
  valor_pago: number | null;
  metodo: string | null;
  status: string | null;
  created_at: string | null;
};

type DashboardPayload = {
  kpis: KpiStats;
  avisos: Aviso[];
  eventos: Evento[];
  curriculoPendenciasHorario: number;
  curriculoPendenciasAvaliacao: number;
  charts?: {
    meses: string[];
    alunosPorMes: number[];
    pagamentos: any; // depois tipamos direito (PagamentosResumo)
  };
  inadimplenciaTop?: InadimplenciaTopRow[];
  pagamentosRecentes?: PagamentoRecenteRow[];
};

type Props = {
  escolaId: string;
  escolaNome?: string;
};

const hasComponentes = (config?: { componentes?: { code: string }[] }) => (
  Array.isArray(config?.componentes) && config.componentes.length > 0
);

export default async function EscolaAdminDashboardData({ escolaId, escolaNome }: Props) {
  const s = await supabaseServer();
  const cookieHeader = (await cookies()).toString();
  const host = (await headers()).get("host");
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  const baseUrl = host ? `${protocol}://${host}` : "";

  const fetchJson = async <T,>(path: string, fallback: T) => {
    if (!baseUrl) return fallback;
    const res = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok || !json?.ok) return fallback;
    return json as T;
  };

  try {
    // ✅ 1) KPIs (ajusta nomes de tabela/coluna conforme teu schema real)
    // Vou manter isso “agnóstico”: você substitui pelas tuas views/funcs.
    // O objetivo aqui é o padrão: tudo no server, nada de componente client buscando.
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

  const todayKey = new Date().toISOString().slice(0, 10);

  const [
    dashboardCounts,
    pendingTurmasCount,
    draftCurriculosResult,
    setupStatusResult,
    configResult,
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
    missingPricingQuery,
    financeiroKpiQuery,
    s.from("escolas").select("nome").eq("id", escolaId).maybeSingle(),
    fetchJson(
      `/api/escolas/${escolaId}/admin/dashboard`,
      { ok: false, charts: null }
    ),
    fetchJson(
      `/api/escolas/${escolaId}/admin/financeiro/inadimplencia-top?limit=5`,
      { ok: false, data: [] }
    ),
    fetchJson(
      `/api/escolas/${escolaId}/admin/financeiro/pagamentos-recentes?limit=10&day_key=${todayKey}`,
      { ok: false, data: [] }
    ),
  ]);

        const setupData = setupStatusResult.data;
        const config = configResult.data;
        const avaliacaoOk = hasComponentes(config?.avaliacao_config as any);
        const frequenciaOk = Boolean(config?.frequencia_modelo)
          && typeof config?.frequencia_min_percent === "number";
        const avaliacaoFrequenciaOk = avaliacaoOk && frequenciaOk;
        const setupStatus: SetupStatus = {
          anoLetivoOk: Boolean(setupData?.has_ano_letivo_ativo),
          periodosOk: Boolean(setupData?.has_3_trimestres),
          avaliacaoOk,
          frequenciaOk,
          avaliacaoFrequenciaOk,
          curriculoOk: Boolean(setupData?.has_curriculo_published),
          turmasOk: Boolean(setupData?.has_turmas_no_ano),
          setupComplete: false,
        };
        setupStatus.setupComplete = (
          setupStatus.anoLetivoOk
          && setupStatus.periodosOk
          && setupStatus.avaliacaoFrequenciaOk
          && setupStatus.curriculoOk
          && setupStatus.turmasOk
        );
    
        // Se alguma tabela não existir ainda, isso vai dar erro.
        // Por isso: normaliza fallback seguro.
        const financeiroKpis = (financeiroKpiResult.data ?? []) as Array<{
          mes_ref?: string | null
          previsto_total?: number | null
          realizado_total?: number | null
        }>;
        const kpiAtual = financeiroKpis[0];
        const previsto = Number(kpiAtual?.previsto_total ?? 0);
        const realizado = Number(kpiAtual?.realizado_total ?? 0);
        const financeiroPercent = previsto > 0
          ? Math.round((realizado / previsto) * 100)
          : 0;

        const stats: KpiStats = {
          alunos: dashboardCounts.data?.alunos_ativos ?? 0,
          turmas: dashboardCounts.data?.turmas_total ?? 0,
          professores: dashboardCounts.data?.professores_total ?? 0,
          avaliacoes: dashboardCounts.data?.avaliacoes_total ?? 0,
          financeiro: financeiroPercent,
        };
    
        const pendingCount = pendingTurmasCount.data?.pendentes_total ?? 0;
        const missingPricingCount = Number(missingPricingResult.data?.[0]?.missing_count ?? 0);
    
        // ✅ 2) Avisos / Eventos (placeholder, ajusta origem real)
        const avisos: Aviso[] = [];
        const eventos: Evento[] = [];
    
        const draftCurriculoIds = (draftCurriculosResult.data ?? [])
          .map((row: any) => row.id)
          .filter(Boolean);
        let curriculoPendenciasHorario = 0;
        let curriculoPendenciasAvaliacao = 0;
        if (draftCurriculoIds.length > 0) {
          const [pendenciasHorarioRes, pendenciasAvaliacaoRes] = await Promise.all([
            s
              .from("curso_matriz")
              .select("disciplina_id")
              .eq("escola_id", escolaId)
              .eq("status_horario", "incompleto")
              .in("curso_curriculo_id", draftCurriculoIds),
            s
              .from("curso_matriz")
              .select("disciplina_id")
              .eq("escola_id", escolaId)
              .eq("status_avaliacao", "incompleto")
              .in("curso_curriculo_id", draftCurriculoIds),
          ]);

          const uniqueHorario = new Set(
            (pendenciasHorarioRes.data ?? [])
              .map((row: any) => row?.disciplina_id)
              .filter(Boolean)
          );
          const uniqueAvaliacao = new Set(
            (pendenciasAvaliacaoRes.data ?? [])
              .map((row: any) => row?.disciplina_id)
              .filter(Boolean)
          );

          curriculoPendenciasHorario = uniqueHorario.size;
          curriculoPendenciasAvaliacao = uniqueAvaliacao.size;
        }

        const charts = (dashboardChartsRes as any)?.charts ?? undefined;
        const inadimplenciaTop = (inadimplenciaTopRes as any)?.data ?? [];
        const pagamentosRecentes = (pagamentosRecentesRes as any)?.data ?? [];
        const payload: DashboardPayload = {
          kpis: stats,
          avisos,
          eventos,
          curriculoPendenciasHorario,
          curriculoPendenciasAvaliacao,
          charts: charts ?? undefined,
          inadimplenciaTop,
          pagamentosRecentes,
        };

        const financeiroHref = "/financeiro";
    
        return (
          <EscolaAdminDashboardContent
            escolaId={escolaId}
            escolaNome={escolaNome ?? escolaNomeResult.data?.nome ?? undefined}
            loading={false}
            error={null}
            stats={payload.kpis}
            pendingTurmasCount={pendingCount}
            notices={payload.avisos}
            events={payload.eventos}
            charts={payload.charts as any}
            setupStatus={setupStatus}
            missingPricingCount={missingPricingCount}
            financeiroHref={financeiroHref}
            pagamentosKpis={payload.charts?.pagamentos as any}
            inadimplenciaTop={payload.inadimplenciaTop}
            pagamentosRecentes={payload.pagamentosRecentes}
            curriculoPendenciasHorarioCount={payload.curriculoPendenciasHorario}
            curriculoPendenciasAvaliacaoCount={payload.curriculoPendenciasAvaliacao}
          />
        );
      } catch (e: any) {
        // ✅ fallback forte, sem quebrar UI
        const stats: KpiStats = { alunos: 0, turmas: 0, professores: 0, avaliacoes: 0 };
        const setupStatus: SetupStatus = {
          anoLetivoOk: false,
          periodosOk: false,
          avaliacaoOk: false,
          frequenciaOk: false,
          avaliacaoFrequenciaOk: false,
          curriculoOk: false,
          turmasOk: false,
          setupComplete: false,
        };

        return (
          <EscolaAdminDashboardContent
            escolaId={escolaId}
            escolaNome={escolaNome ?? undefined}
            loading={false}
            error={e?.message ?? "Falha ao carregar dashboard"}
            stats={stats}
            pendingTurmasCount={0}
            notices={[]}
            events={[]}
            charts={undefined}
            setupStatus={setupStatus}
            missingPricingCount={0}
            financeiroHref="/financeiro"
            pagamentosKpis={undefined}
          />
        );
      }
    }
    
