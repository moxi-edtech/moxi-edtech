// apps/web/src/components/layout/escola-admin/EscolaAdminDashboardData.tsx
import "server-only";

import EscolaAdminDashboardContent from "./EscolaAdminDashboardContent";
import { supabaseServer } from "@/lib/supabaseServer";
import type { KpiStats } from "./KpiSection";

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

export default async function EscolaAdminDashboardData({ escolaId, escolaNome }: Props) {
  const s = await supabaseServer();

  try {
    // ✅ 1) KPIs (ajusta nomes de tabela/coluna conforme teu schema real)
    // Vou manter isso “agnóstico”: você substitui pelas tuas views/funcs.
    // O objetivo aqui é o padrão: tudo no server, nada de componente client buscando.
        const [
          alunosCount,
          turmasCount,
          professoresCount,
          avaliacoesCount,
          pendingTurmasCount,
          escolaData, // Fetch escola data to get onboarding status
        ] = await Promise.all([
          s.from("alunos")
            .select("id", { count: "exact", head: true })
            .eq("escola_id", escolaId),
    
          s.from("turmas")
            .select("id", { count: "exact", head: true })
            .eq("escola_id", escolaId),
    
          s.from("professores")
            .select("id", { count: "exact", head: true })
            .eq("escola_id", escolaId),
    
          s.from("avaliacoes")
            .select("id", { count: "exact", head: true })
            .eq("escola_id", escolaId),
    
          s.from("turmas")
            .select("id", { count: "exact", head: true })
            .eq("escola_id", escolaId)
            .neq("status_validacao", "ativo"),
    
          s.from("escolas") // New query to get onboarding status
            .select("onboarding_finalizado")
            .eq("id", escolaId)
            .single(),
        ]);
    
        const onboardingComplete = escolaData.data?.onboarding_finalizado ?? false;
    
        // Se alguma tabela não existir ainda, isso vai dar erro.
        // Por isso: normaliza fallback seguro.
        const stats: KpiStats = {
          alunos: alunosCount.count ?? 0,
          turmas: turmasCount.count ?? 0,
          professores: professoresCount.count ?? 0,
          avaliacoes: avaliacoesCount.count ?? 0,
        };
    
        const pendingCount = pendingTurmasCount.count ?? 0;
    
        // ✅ 2) Avisos / Eventos (placeholder, ajusta origem real)
        const avisos: Aviso[] = [];
        const eventos: Evento[] = [];
    
        const payload: DashboardPayload = {
          kpis: stats,
          avisos,
          eventos,
          charts: undefined,
        };
    
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
            onboardingComplete={onboardingComplete} // Pass the new prop
            pagamentosKpis={payload.charts?.pagamentos as any}
          />
        );
      } catch (e: any) {
        // ✅ fallback forte, sem quebrar UI
        const stats: KpiStats = { alunos: 0, turmas: 0, professores: 0, avaliacoes: 0 };
    
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
            onboardingComplete={false} // Default value for error case
            pagamentosKpis={undefined}
          />
        );
      }
    }
    