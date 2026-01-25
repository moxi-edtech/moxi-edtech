// apps/web/src/components/layout/escola-admin/EscolaAdminDashboardData.tsx
import "server-only";

import EscolaAdminDashboardContent from "./EscolaAdminDashboardContent";
import { supabaseServer } from "@/lib/supabaseServer";
import type { KpiStats } from "./KpiSection";
import type { SetupStatus } from "./setupStatus";
import { findClassesSemPreco } from "@/lib/financeiro/missing-pricing";
import { applyKf2ListInvariants } from "@/lib/kf2";

/**
 * Padrão KLASSE:
 * - Server component busca tudo
 * - Passa apenas plain objects para o client component (Content)
 * - Zero fetch() no client para dados do dashboard
 */
type Aviso = { id: string; titulo: string; dataISO: string };
type Evento = { id: string; titulo: string; dataISO: string };

type DashboardPayload = {
  kpis: KpiStats;
  avisos: Aviso[];
  eventos: Evento[];
  charts?: {
    meses: string[];
    alunosPorMes: number[];
    pagamentos: any; // depois tipamos direito (PagamentosResumo)
  };
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

  try {
    // ✅ 1) KPIs (ajusta nomes de tabela/coluna conforme teu schema real)
    // Vou manter isso “agnóstico”: você substitui pelas tuas views/funcs.
    // O objetivo aqui é o padrão: tudo no server, nada de componente client buscando.
        const missingPricingPromise = findClassesSemPreco(s as any, escolaId, null)
          .then((result) => result.items.length)
          .catch(() => 0);

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
          pendingTurmasCount,
          setupStatusResult,
          configResult,
          missingPricingCount,
          financeiroKpiResult,
        ] = await Promise.all([
          s.from("vw_admin_dashboard_counts")
            .select("alunos_ativos, turmas_total, professores_total, avaliacoes_total")
            .eq("escola_id", escolaId)
            .maybeSingle(),

          s.from("vw_admin_pending_turmas_count")
            .select("pendentes_total")
            .eq("escola_id", escolaId)
            .maybeSingle(),

          s.from("vw_escola_setup_status")
            .select("has_ano_letivo_ativo, has_3_trimestres, has_curriculo_published, has_turmas_no_ano")
            .eq("escola_id", escolaId)
            .maybeSingle(),

          s.from("configuracoes_escola")
            .select("frequencia_modelo, frequencia_min_percent, modelo_avaliacao, avaliacao_config")
            .eq("escola_id", escolaId)
            .maybeSingle(),
          missingPricingPromise,
          financeiroKpiQuery,
        ]);

        const setupData = setupStatusResult.data;
        const config = configResult.data;
        const modeloAvaliacao = (config?.modelo_avaliacao ?? "DEPOIS").toString().toUpperCase();
        const avaliacaoOk = modeloAvaliacao !== "DEPOIS" && hasComponentes(config?.avaliacao_config as any);
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
    
        // ✅ 2) Avisos / Eventos (placeholder, ajusta origem real)
        const avisos: Aviso[] = [];
        const eventos: Evento[] = [];
    
        const payload: DashboardPayload = {
          kpis: stats,
          avisos,
          eventos,
          charts: undefined,
        };

        const financeiroHref = `/escola/${escolaId}/financeiro`;
    
        return (
          <EscolaAdminDashboardContent
            escolaId={escolaId}
            escolaNome={escolaNome}
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
            escolaNome={escolaNome}
            loading={false}
            error={e?.message ?? "Falha ao carregar dashboard"}
            stats={stats}
            pendingTurmasCount={0}
            notices={[]}
            events={[]}
            charts={undefined}
            setupStatus={setupStatus}
            missingPricingCount={0}
            financeiroHref={`/escola/${escolaId}/financeiro`}
            pagamentosKpis={undefined}
          />
        );
      }
    }
    
