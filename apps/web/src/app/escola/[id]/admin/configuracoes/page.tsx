"use client";

import { useState, useEffect, use } from "react";
import { Loader2 } from "lucide-react";

// Importa os componentes (ajusta os caminhos se necessário)
import AcademicSetupWizard from "@/components/escola/onboarding/AcademicSetupWizard";
import SettingsHub from "@/components/escola/settings/SettingsHub";
import SettingsHubSkeleton from "@/components/escola/settings/SettingsHubSkeleton";

// Definição de Props para Next.js 15
type Props = {
  params: Promise<{ id: string }>;
};

export default function ConfiguracoesPage({ params }: Props) {
  // 1. Desembrulha os params (Obrigatório no Next.js 15)
  const resolvedParams = use(params);
  const escolaId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [forceWizard, setForceWizard] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [pageSetupStatus, setPageSetupStatus] = useState<{ // Renamed to avoid conflict
    has_ano_letivo_ativo: boolean;
    has_3_trimestres: boolean;
    has_curriculo_published: boolean;
    has_turmas_no_ano: boolean;
    percentage: number;
  } | null>(null);

  // States for SettingsHub data
  const [avaliacaoPending, setAvaliacaoPending] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [fullSetupStatus, setFullSetupStatus] = useState<{
    ano_letivo_ok?: boolean;
    periodos_ok?: boolean;
    avaliacao_ok?: boolean;
    curriculo_draft_ok?: boolean;
    curriculo_published_ok?: boolean;
    turmas_ok?: boolean;
  } | null>(null);
  const [estruturaCounts, setEstruturaCounts] = useState<{
    cursos_total?: number;
    classes_total?: number;
    disciplinas_total?: number;
  } | null>(null);

  // 2. Verificar Estado da Escola no Cliente
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      if (!escolaId) {
        setLoading(false);
        return;
      }
      try {
        // --- Existing checkStatus logic for pageSetupStatus ---
        const pageRes = await fetch(`/api/escola/${escolaId}/admin/setup/status`, {
          cache: "no-store",
        });
        const pageJson = await pageRes.json().catch(() => null);
        if (cancelled) return;
        
        if (pageRes.ok && pageJson?.data) {
          setPageSetupStatus(pageJson.data);
        } else {
          setPageSetupStatus(null);
        }

        // --- SettingsHub data fetching logic ---
        const res = await fetch(`/api/escola/${escolaId}/admin/setup/state`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "Erro ao carregar configurações.");
        if (cancelled) return;

        const data = json?.data ?? {};
        setFullSetupStatus({
          ano_letivo_ok: data?.badges?.ano_letivo_ok,
          periodos_ok: data?.badges?.periodos_ok,
          avaliacao_ok: data?.badges?.avaliacao_ok,
          curriculo_draft_ok: data?.badges?.curriculo_draft_ok,
          curriculo_published_ok: data?.badges?.curriculo_published_ok,
          turmas_ok: data?.badges?.turmas?.ok,
        });
        if (typeof data?.badges?.avaliacao_ok === "boolean") {
          setAvaliacaoPending(!data.badges.avaliacao_ok);
        }
        
        if (typeof data?.completion_percent === 'number') {
          setProgress(data.completion_percent);
        }

        const impactRes = await fetch(`/api/escola/${escolaId}/admin/setup/impact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const impactJson = await impactRes.json().catch(() => null);
        if (cancelled) return;
        
        if (impactRes.ok && impactJson?.ok) {
          const counts = impactJson?.data?.counts;
          setEstruturaCounts({
            cursos_total: counts?.cursos_afetados ?? 0,
            classes_total: counts?.classes_afetadas ?? 0,
            disciplinas_total: counts?.disciplinas_afetadas ?? 0,
          });
        }

      } catch (error: any) {
        console.error("Erro ao carregar dados:", error);
        if (!cancelled) {
          setPageSetupStatus(null); // Reset page status on error
          setFullSetupStatus(null); // Reset SettingsHub status on error
          setAvaliacaoPending(null); 
          setProgress(null);
          setEstruturaCounts(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    fetchData();

    return () => {
      cancelled = true;
    };
  }, [escolaId]);

  // 3. Estado de Carregamento
  if (loading) {
    return <SettingsHubSkeleton />;
  }

  const setupComplete = Boolean(pageSetupStatus && pageSetupStatus.percentage === 100);

  const checklistItems = [
    { label: "Ano letivo ativo", ok: pageSetupStatus?.has_ano_letivo_ativo },
    { label: "3 trimestres configurados", ok: pageSetupStatus?.has_3_trimestres },
    { label: "Currículo publicado", ok: pageSetupStatus?.has_curriculo_published },
    { label: "Turmas geradas no ano", ok: pageSetupStatus?.has_turmas_no_ano },
  ];

  // 4. MODO WIZARD (apenas quando forçado)
  if (forceWizard) {
    return (
      <div className="bg-slate-50 min-h-screen">
        {/* Botão de voltar (só aparece se for edição manual) */}
        {setupComplete && (
          <div className="max-w-6xl mx-auto pt-6 px-6">
            <button 
              onClick={() => setForceWizard(false)} 
              className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-2 transition-colors"
            >
              ← Voltar ao menu
            </button>
          </div>
        )}
        
        <AcademicSetupWizard 
          escolaId={escolaId} 
          onComplete={() => {
            setForceWizard(false);
          }}
        />
      </div>
    );
  }

  // 5. MODO HUB (Painel de Configurações)
  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-6 pt-6">
        {!setupComplete && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold">Ação necessária</div>
                <div className="text-sm mt-0.5">
                  Complete o setup acadêmico para liberar o portal.
                </div>
                {pageSetupStatus && (
                  <div className="text-xs text-amber-800 mt-1">
                    Progresso atual: {pageSetupStatus.percentage}%
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setForceWizard(true)}
                  className="inline-flex items-center justify-center rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
                >
                  Iniciar Assistente
                </button>
                <button
                  type="button"
                  onClick={() => setShowChecklist((prev) => !prev)}
                  className="inline-flex items-center justify-center rounded-md border border-amber-400 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                >
                  Ver o que falta
                </button>
              </div>
            </div>
            {showChecklist && (
              <div className="mt-4 space-y-1 text-sm">
                {checklistItems.map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-full ${item.ok ? "bg-emerald-500" : "bg-amber-500"}`} />
                    <span className={item.ok ? "text-emerald-700" : "text-amber-800"}>{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <SettingsHub 
        escolaId={escolaId} 
        onOpenWizard={() => setForceWizard(true)} 
        avaliacaoPending={avaliacaoPending}
        progress={progress}
        setupStatus={fullSetupStatus}
        estruturaCounts={estruturaCounts}
      />
    </div>
  );
}
